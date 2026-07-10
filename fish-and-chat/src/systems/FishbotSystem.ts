import type { FishbotDefinition, ThemeId } from '../game/data';
import { pickRandom, pickSpeciesForRarity, pickTrashItem, rollWeightKg } from '../game/loot';
import type { Economy } from '../game/Economy';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';
import { castPrecision, precisionSkillBonus, randomSweetSpot } from './CastingSystem';

const OFFLINE_PROGRESS_CAP_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_OFFLINE_TICKS_PER_BOT = 200; // safety backstop, not a real gameplay limit

export class FishbotSystem {
  constructor(
    private readonly economy: Economy,
    private readonly events: EventBus<GameEventMap>,
  ) {}

  /** Only the currently equipped bot works the dock — see Economy.equipFishbot. */
  private equippedBot(): FishbotDefinition | null {
    const id = this.economy.equippedFishbotId();
    if (!id) return null;
    return this.economy.fishbotDefinition(id) ?? null;
  }

  /** Call once at startup, before the render loop begins. */
  simulateOfflineProgress(theme: ThemeId): void {
    const bot = this.equippedBot();
    if (!bot) return;
    const state = this.economy.fishbotState(bot.id);
    if (!state) return;

    const lastActive = this.economy.lastActiveAtMs();
    const now = Date.now();
    const horizon = Math.min(now, lastActive + OFFLINE_PROGRESS_CAP_MS);
    if (horizon <= lastActive) return;

    let claimed = 0;
    const intervalMs = bot.baseIntervalSeconds * 1000 * this.economy.fishbotIntervalMultiplier();
    let nextReady = state.nextReadyAtMs;
    let ticks = 0;

    while (nextReady <= horizon && ticks < MAX_OFFLINE_TICKS_PER_BOT) {
      if (this.economy.hopperFull()) break;
      this.depositCatch(bot, theme);
      claimed += 1;
      ticks += 1;
      nextReady += intervalMs;
    }

    this.economy.setFishbotNextReady(bot.id, nextReady);
    if (claimed > 0) this.events.emit('toast', { message: `Your fishbot caught ${claimed} while you were away.` });
  }

  /** Call every frame. */
  update(nowMs: number, theme: ThemeId): void {
    const bot = this.equippedBot();
    if (!bot) return;
    const state = this.economy.fishbotState(bot.id);
    if (!state) return;
    if (nowMs < state.nextReadyAtMs) return;

    const intervalMs = bot.baseIntervalSeconds * 1000 * this.economy.fishbotIntervalMultiplier();
    if (!this.economy.hopperFull()) {
      this.depositCatch(bot, theme);
    }
    this.economy.setFishbotNextReady(bot.id, nowMs + intervalMs);
  }

  claimHopper(): number {
    const claimed = this.economy.claimHopper();
    if (claimed.length > 0) this.events.emit('fishbotClaimed', { count: claimed.length });
    return claimed.length;
  }

  private depositCatch(bot: FishbotDefinition, theme: ThemeId): void {
    const rarity = pickRandom(bot.rarityBias);
    if (rarity === 'trash') {
      const trash = pickTrashItem();
      this.economy.addToHopper({ catchId: trash.id, isTrash: true, weightKg: rollWeightKg(trash.weightRangeKg), caughtAt: Date.now() });
      return;
    }
    // Mk II simulates a phantom cast each cycle — same odds as a player's tap
    // (CastingSystem's gauge math) — and, on top of the player's own gear/level
    // skill, gets the real precision bonus when that random cast happens to land
    // close to the sweet spot's red line. Mk I ignores the player's skill entirely.
    const effectiveSkill = bot.id === 'fishbot-mk2' ? this.economy.effectiveSkill(this.rollPhantomCastBonus()) : 0;
    const species = pickSpeciesForRarity(rarity, theme, effectiveSkill);
    this.economy.addToHopper({ catchId: species.id, isTrash: false, weightKg: rollWeightKg(species.weightRangeKg), caughtAt: Date.now() });
  }

  private rollPhantomCastBonus(): number {
    const gauge = randomSweetSpot();
    const precision = castPrecision(Math.random(), gauge);
    return precisionSkillBonus(precision);
  }
}
