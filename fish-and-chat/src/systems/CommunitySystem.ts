import type { EventBus } from '../core/EventBus';
import type { CatchResult, GameEventMap } from '../game/events';
import type { Economy, RecycleResult } from '../game/Economy';
import {
  createCommunityGoal,
  getNextGoalTemplate,
  type CommunityGoal,
} from '../game/CommunityGoals';
import type { LivingWorldSystem } from './LivingWorldSystem';

export interface CommunitySystemOptions {
  ambientSimulationEnabled?: boolean;
  ambientIntervalMinSeconds?: number;
  ambientIntervalMaxSeconds?: number;
  bossCooldownSeconds?: number;
  initialGoalId?: string;
  livingWorld?: LivingWorldSystem;
}

export const SIMULATED_CHAT_ANGLERS = [
  'FishMaster42',
  'CozyAngler',
  'BiteKing',
  'PixelFisher',
  'ReelDeal',
  'BarnabyFan',
  'SeaBreeze99',
  'NeonCast',
  'WaveWhisperer',
  'TackleBoxHero',
  'GlitchGill',
  'SaltyDoggo',
] as const;

export class CommunitySystem {
  private activeGoal: CommunityGoal;
  private inCooldown = false;
  private cooldownTimer = 0;
  private ambientTimer = 0;

  private readonly ambientSimulationEnabled: boolean;
  private readonly ambientIntervalMin: number;
  private readonly ambientIntervalMax: number;
  private readonly bossCooldownDuration: number;
  private livingWorld?: LivingWorldSystem;

  constructor(
    private readonly economy: Economy,
    private readonly events: EventBus<GameEventMap>,
    options?: CommunitySystemOptions,
  ) {
    // Fake anglers are useful in explicit demos, never as a default source of rewards.
    this.ambientSimulationEnabled = options?.ambientSimulationEnabled ?? false;
    this.ambientIntervalMin = options?.ambientIntervalMinSeconds ?? 15;
    this.ambientIntervalMax = options?.ambientIntervalMaxSeconds ?? 30;
    this.bossCooldownDuration = options?.bossCooldownSeconds ?? 15;
    this.livingWorld = options?.livingWorld;

    // Load active goal from saved state or default
    const savedGoalId = options?.initialGoalId ?? this.economy.activeCommunityGoalId();
    this.activeGoal = createCommunityGoal(savedGoalId);

    // Restore saved progress; if a reload interrupted the 15s post-completion cooldown at 100%, advance to the next raid.
    const savedProgress = this.economy.communityGoalProgress();
    if (savedProgress >= this.activeGoal.targetValue) {
      this.activeGoal = getNextGoalTemplate(this.activeGoal.id);
      this.economy.setActiveCommunityGoalId(this.activeGoal.id);
      this.economy.setCommunityGoalProgress(0);
    } else {
      this.activeGoal.currentValue = Math.max(0, savedProgress);
    }

    this.resetAmbientTimer();
    this.wireEvents();
  }

  public setLivingWorld(livingWorld: LivingWorldSystem): void {
    this.livingWorld = livingWorld;
  }

  private wireEvents(): void {
    this.events.on('catchResolved', ({ result }) => {
      this.onCatch(result);
    });

    this.events.on('trashRecycled', ({ result }) => {
      this.onTrashRecycled(result);
    });

    this.events.on('castLocked', ({ precision }) => {
      this.onCastLocked(precision);
    });

    this.events.on('premiumItemPurchased', ({ id, ok }) => {
      this.onPremiumItemPurchased(id, ok);
    });
  }

  private getPlayerDisplayName(): string {
    return this.economy.displayName();
  }

  private resetAmbientTimer(): void {
    const min = Math.max(0.01, this.ambientIntervalMin);
    const max = Math.max(min, this.ambientIntervalMax);
    const range = max - min;
    this.ambientTimer = min + Math.random() * range;
  }

  public getActiveGoal(): CommunityGoal {
    return {
      ...this.activeGoal,
      cheerPacks: this.activeGoal.cheerPacks.map((c) => ({ ...c })),
      completionRewards: { ...this.activeGoal.completionRewards },
    };
  }

  public getProgressRatio(): number {
    if (this.activeGoal.targetValue <= 0) return 0;
    return Math.min(1, this.activeGoal.currentValue / this.activeGoal.targetValue);
  }

  public isInCooldown(): boolean {
    return this.inCooldown;
  }

  public getCooldownRemaining(): number {
    return Math.max(0, this.cooldownTimer);
  }

  /**
   * Adds progress to the active community goal and triggers completion if target is reached.
   */
  public addProgress(amount: number, contributor?: string): void {
    if (amount <= 0) return;
    if (this.inCooldown) return;
    if (this.activeGoal.currentValue >= this.activeGoal.targetValue) return;

    const prev = this.activeGoal.currentValue;
    const next = Math.min(this.activeGoal.targetValue, Math.round((prev + amount) * 10) / 10);
    this.activeGoal.currentValue = next;
    this.economy.setCommunityGoalProgress(next);

    this.events.emit('communityProgressUpdated', {
      goalId: this.activeGoal.id,
      current: next,
      target: this.activeGoal.targetValue,
      contributor,
    });

    if (next >= this.activeGoal.targetValue) {
      this.onGoalCompleted();
    }
  }

  /**
   * Purchases a bit cheer pack with Candy Bars to boost community progress.
   */
  public contributeCheer(cheerId: string): boolean {
    if (this.economy.usesServerCandy) {
      this.events.emit('toast', { message: 'Channel raid Candy boosts are unavailable on Twitch right now.' });
      return false;
    }
    if (this.inCooldown) return false;
    if (this.activeGoal.currentValue >= this.activeGoal.targetValue) return false;

    const pack = this.activeGoal.cheerPacks.find((c) => c.id === cheerId);
    if (!pack) return false;

    if (this.economy.snapshot.candyBars < pack.costCandyBars) {
      this.events.emit('toast', { message: `Not enough Candy Bars! Need ${pack.costCandyBars} 🍫.` });
      return false;
    }

    const spent = this.economy.spendCandyBars(pack.costCandyBars);
    if (!spent) return false;

    const playerName = this.getPlayerDisplayName();
    this.addProgress(pack.progressBoost, playerName);

    this.events.emit('toast', {
      message: `🍫 ${playerName} cheered with ${pack.name}! (+${pack.progressBoost} progress)`,
    });
    return true;
  }

  private onCatch(result: CatchResult): void {
    if (this.inCooldown) return;
    const playerName = this.getPlayerDisplayName();

    if (result.isTrash) {
      if (this.activeGoal.category === 'salvage') {
        this.addProgress(1, playerName);
      }
    } else {
      if (this.activeGoal.category === 'weight') {
        const weight = Math.max(0.1, Math.round(result.weightKg * 10) / 10);
        this.addProgress(weight, playerName);
      } else if (this.activeGoal.category === 'rare_fish') {
        if (result.rarity === 'rare' || result.rarity === 'epic' || result.rarity === 'legendary') {
          this.addProgress(1, playerName);
        }
      }
    }
  }

  private onTrashRecycled(result: RecycleResult): void {
    if (this.inCooldown) return;
    if (this.activeGoal.category === 'salvage' && result.success) {
      const amount = Math.max(1, result.amount);
      this.addProgress(amount, this.getPlayerDisplayName());
    }
  }

  private onCastLocked(precision: number): void {
    if (this.inCooldown) return;
    if (precision >= 0.95) {
      // Perfect cast
      if (this.activeGoal.category === 'perfect_casts') {
        this.addProgress(1, this.getPlayerDisplayName());
      } else if (this.activeGoal.id === 'starlit-serpent') {
        // The Midnight Starlit Serpent accepts both Rare+ catches and Perfect Casts
        this.addProgress(1, this.getPlayerDisplayName());
      }
    }
  }

  private onPremiumItemPurchased(id: string, ok: boolean): void {
    if (!ok || this.inCooldown) return;
    const playerName = this.getPlayerDisplayName();

    if (id === 'mega-chum-bucket' && this.activeGoal.category === 'weight') {
      this.addProgress(25, playerName);
    } else if (id === 'master-salvage-magnet' && this.activeGoal.category === 'salvage') {
      this.addProgress(5, playerName);
    } else if (id === 'rainbow-totem' && this.activeGoal.category === 'rare_fish') {
      this.addProgress(3, playerName);
    }
  }

  private onGoalCompleted(): void {
    const goal = this.activeGoal;
    const rewards = goal.completionRewards;
    const firstCompletion = !this.economy.snapshot.completedCommunityGoalIds?.includes(goal.id);

    // 1. Boss emergence event (LivingWorldSystem emits whaleJump via onBreach)
    if (this.livingWorld) {
      this.livingWorld.triggerWhaleJump();
    } else {
      this.events.emit('whaleJump', { position: { x: 0, y: 0, z: -12 } });
    }
    this.events.emit('toast', {
      message: `🌊 BOSS EMERGENCE: ${goal.bossName} emerges from the waters!`,
    });

    // 2. Fire celebration event communityGoalCompleted with rewards
    this.events.emit('communityGoalCompleted', {
      goalId: goal.id,
      name: goal.name,
      rewards: firstCompletion ? { ...rewards, candyBars: this.economy.usesServerCandy ? 0 : rewards.candyBars } : { ...rewards, coins: 0, xp: 0, candyBars: 0 },
    });

    // 3. Award completion rewards to player's economy
    if (firstCompletion) {
      this.economy.addCoins(rewards.coins);
      this.economy.addXp(rewards.xp);
      this.economy.addCandyBars(rewards.candyBars);
      this.economy.unlockTitle(rewards.title);
      this.economy.recordCommunityGoalCompletion(goal.id);
    }

    this.events.emit('toast', {
      message: firstCompletion
        ? `🎉 Raid complete! +${rewards.coins}🪙, +${rewards.xp} XP${this.economy.usesServerCandy ? '' : `, +${rewards.candyBars}🍫`} & title "${rewards.title}"!`
        : '🎉 Raid complete! You already claimed this raid’s one-time reward.',
    });

    // 4. Start cooldown before spawning next raid
    this.inCooldown = true;
    this.cooldownTimer = this.bossCooldownDuration;
  }

  /**
   * Spawns the next community raid in the catalog and resets progress.
   */
  public spawnNextRaid(): void {
    const nextGoal = getNextGoalTemplate(this.activeGoal.id);
    this.activeGoal = nextGoal;
    this.inCooldown = false;
    this.cooldownTimer = 0;

    this.economy.setActiveCommunityGoalId(this.activeGoal.id);
    this.economy.setCommunityGoalProgress(0);

    this.events.emit('communityProgressUpdated', {
      goalId: this.activeGoal.id,
      current: 0,
      target: this.activeGoal.targetValue,
    });

    this.events.emit('toast', {
      message: `⚔️ New Channel Raid Active: ${this.activeGoal.name}!`,
    });

    this.resetAmbientTimer();
  }

  /**
   * Manually switches or sets the active community raid (e.g. for testing or debug).
   */
  public setGoal(goalId: string): void {
    this.activeGoal = createCommunityGoal(goalId);
    this.inCooldown = false;
    this.cooldownTimer = 0;

    this.economy.setActiveCommunityGoalId(this.activeGoal.id);
    this.economy.setCommunityGoalProgress(0);

    this.events.emit('communityProgressUpdated', {
      goalId: this.activeGoal.id,
      current: 0,
      target: this.activeGoal.targetValue,
    });

    this.resetAmbientTimer();
  }

  public update(delta: number): void {
    // 1. Handle boss emergence cooldown
    if (this.inCooldown) {
      this.cooldownTimer -= delta;
      if (this.cooldownTimer <= 0) {
        this.spawnNextRaid();
      }
      return;
    }

    // 2. Handle ambient simulated channel angler contributions
    if (this.ambientSimulationEnabled) {
      this.ambientTimer -= delta;
      if (this.ambientTimer <= 0) {
        this.resetAmbientTimer();
        this.simulateAmbientContribution();
      }
    }
  }

  private simulateAmbientContribution(): void {
    if (this.inCooldown || this.activeGoal.currentValue >= this.activeGoal.targetValue) return;

    // Pick random simulated angler from chat
    const angler = SIMULATED_CHAT_ANGLERS[Math.floor(Math.random() * SIMULATED_CHAT_ANGLERS.length)];

    let amount = 1;
    switch (this.activeGoal.category) {
      case 'weight':
        // Friendly catch between 1.5 kg and 6.5 kg
        amount = Math.round((1.5 + Math.random() * 5.0) * 10) / 10;
        break;
      case 'salvage':
        amount = Math.random() < 0.25 ? 2 : 1;
        break;
      case 'rare_fish':
        amount = 1;
        break;
      case 'perfect_casts':
        amount = 1;
        break;
    }

    this.addProgress(amount, angler);
  }
}
