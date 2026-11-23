import type { UpgradeId } from '../game/data';
import type { EventBus } from '../core/EventBus';
import type { Economy } from '../game/Economy';
import type { GameEventMap } from '../game/events';
import {
  DAILY_QUEST_TEMPLATES,
  MILESTONES,
  STORY_CHAPTERS,
  type DailyQuest,
  type Milestone,
  type StoryChapter,
} from '../game/StoryGoals';
import { getCurioRelic } from '../game/RelicSystem';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class QuestSystem {
  constructor(
    private readonly economy: Economy,
    private readonly events: EventBus<GameEventMap>,
  ) {
    this.ensureDailyQuests();
    this.wireEvents();
  }

  private wireEvents(): void {
    this.events.on('catchResolved', ({ result }) => {
      this.onCatch(result);
    });

    this.events.on('missed', () => {
      this.onMiss();
    });

    this.events.on('castLocked', ({ precision }) => {
      if (precision >= 0.95) {
        this.onPerfectCast();
      }
    });

    this.events.on('trashRecycled', ({ result }) => {
      if (result.success) {
        this.onTrashRecycled();
      }
    });

    this.events.on('upgradePurchased', ({ id, ok }) => {
      if (ok) {
        this.onUpgradePurchased(id);
      }
    });

    this.events.on('xpGained', ({ leveledUp, newLevel }) => {
      if (leveledUp) {
        this.onLevelUp(newLevel);
      }
    });

    this.events.on('whaleJump', () => {
      this.onWhaleJump();
    });

    this.events.on('loreBottleDiscovered', ({ bottle, bottleId }) => {
      this.unlockRelicForBottle(bottle?.id ?? bottleId);
    });

    this.events.on('marketSold', ({ value }) => {
      this.onMarketSold(value);
    });
  }

  public ensureDailyQuests(): void {
    const state = this.economy.snapshot;
    const now = Date.now();
    const needsRefresh = !state.dailyQuests || state.dailyQuests.length === 0 || now - state.lastDailyQuestRefreshMs > MS_PER_DAY;

    if (needsRefresh) {
      this.refreshDailyQuests(now);
    }
  }

  private refreshDailyQuests(timestamp: number): void {
    const shuffled = [...DAILY_QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, 3).map((template, idx) => ({
      id: `${template.id}_${timestamp}_${idx}`,
      title: template.title,
      description: template.description,
      progress: 0,
      target: template.target,
      completed: false,
      claimed: false,
      type: template.type,
      reward: { ...template.reward },
    }));

    this.economy.setDailyQuests(chosen, timestamp);
  }

  public rerollDailyQuest(questId: string): boolean {
    const quests = this.getDailyQuests();
    const index = quests.findIndex((q) => q.id === questId);
    if (index === -1) return false;

    const available = DAILY_QUEST_TEMPLATES.filter((t) => !quests.some((q) => q.title === t.title));
    if (available.length === 0) return false;

    const template = available[Math.floor(Math.random() * available.length)];
    const newQuest: DailyQuest = {
      id: `${template.id}_${Date.now()}_reroll`,
      title: template.title,
      description: template.description,
      progress: 0,
      target: template.target,
      completed: false,
      claimed: false,
      type: template.type,
      reward: { ...template.reward },
    };

    quests[index] = newQuest;
    this.economy.updateDailyQuests(quests);
    return true;
  }

  public getActiveChapter(): StoryChapter {
    const state = this.economy.snapshot;
    const chapterNum = Math.min(Math.max(1, state.activeStoryChapter), STORY_CHAPTERS.length);
    return STORY_CHAPTERS[chapterNum - 1];
  }

  public getChapterProgress(objectiveId: string): number {
    const stored = this.economy.snapshot.storyProgress[objectiveId] ?? 0;
    for (const chapter of STORY_CHAPTERS) {
      const obj = chapter.objectives.find((item) => item.id === objectiveId);
      if (!obj) continue;
      if (obj.type === 'reach_level') {
        return Math.max(stored, this.economy.snapshot.level);
      }
      if (obj.type === 'craft_upgrade') {
        if (obj.id === 'ch2_craft_rod') {
          const crafted = this.economy.upgradeTier('carbon-rod') > 0 || this.economy.upgradeTier('braided-line') > 0;
          return Math.max(stored, crafted ? 1 : 0);
        }
        if (obj.param) {
          return Math.max(stored, this.economy.upgradeTier(obj.param as UpgradeId) > 0 ? 1 : 0);
        }
      }
      break;
    }
    return stored;
  }

  public isChapterCompleted(chapterId: string): boolean {
    return this.economy.snapshot.completedChapterIds.includes(chapterId);
  }

  public canClaimChapter(chapterId: string): boolean {
    if (this.isChapterCompleted(chapterId)) return false;
    const chapter = STORY_CHAPTERS.find((c) => c.id === chapterId);
    if (!chapter) return false;

    for (const obj of chapter.objectives) {
      const prog = this.getChapterProgress(obj.id);
      if (prog < obj.target) return false;
    }
    return true;
  }

  public claimChapter(chapterId: string): boolean {
    if (!this.canClaimChapter(chapterId)) return false;
    const chapter = STORY_CHAPTERS.find((c) => c.id === chapterId);
    if (!chapter) return false;

    this.economy.claimStoryChapter(chapter);
    this.events.emit('chapterCompleted', {
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      titleReward: chapter.rewards.titleReward,
    });
    return true;
  }

  public getDailyQuests(): DailyQuest[] {
    return this.economy.snapshot.dailyQuests ?? [];
  }

  public canClaimDailyQuest(questId: string): boolean {
    const q = this.getDailyQuests().find((item) => item.id === questId);
    return Boolean(q && q.completed && !q.claimed);
  }

  public claimDailyQuest(questId: string): boolean {
    const quests = this.getDailyQuests();
    const q = quests.find((item) => item.id === questId);
    if (!q || !q.completed || q.claimed) return false;

    q.claimed = true;
    this.economy.updateDailyQuests(quests);
    this.economy.addCoins(q.reward.coins);
    this.economy.addXp(q.reward.xp);
    if (q.reward.candyBars) {
      this.economy.addCandyBars(q.reward.candyBars);
    }
    this.economy.persist();
    this.events.emit('questCompleted', {
      questId: q.id,
      title: q.title,
      reward: this.economy.usesServerCandy ? { ...q.reward, candyBars: 0 } : q.reward,
    });
    return true;
  }

  public getMilestones(): Milestone[] {
    return MILESTONES;
  }

  public isMilestoneClaimed(milestoneId: string): boolean {
    return (this.economy.snapshot.claimedMilestoneIds ?? []).includes(milestoneId);
  }

  public canClaimMilestone(milestoneId: string): boolean {
    if (this.isMilestoneClaimed(milestoneId)) return false;
    const m = MILESTONES.find((item) => item.id === milestoneId);
    if (!m) return false;

    const state = this.economy.snapshot;
    let current = 0;
    switch (m.category) {
      case 'catches':
        current = state.totalFishCaught;
        break;
      case 'weight':
        current = state.totalWeightKgCaught;
        break;
      case 'species':
        current = state.discoveredCatchIds.length;
        break;
      case 'salvage':
        current = state.totalTrashRecycled;
        break;
    }
    return current >= m.target;
  }

  public claimMilestone(milestoneId: string): boolean {
    if (!this.canClaimMilestone(milestoneId)) return false;
    const m = MILESTONES.find((item) => item.id === milestoneId);
    if (!m) return false;

    this.economy.claimMilestone(m);
    this.events.emit('milestoneClaimed', {
      milestoneId: m.id,
      name: m.name,
      reward: this.economy.usesServerCandy ? { ...m.reward, candyBars: 0 } : m.reward,
    });
    return true;
  }

  // --- Internal Progress Handlers ---

  private onCatch(result: { catchId: string; rarity: string; isTrash: boolean; weightKg: number }): void {
    if (!result.isTrash) {
      this.economy.incrementTotalFishCaught(1, result.weightKg);
      const streak = this.economy.incrementCatchStreak();
      this.events.emit('streakChanged', { streak, bestStreak: this.economy.bestCatchStreak() });

      // Check current weather
      const currentWeather = this.economy.currentWeather?.() ?? 'clear';
      if (currentWeather === 'rain' || currentWeather === 'fog' || currentWeather === 'rainbow') {
        this.updateChapterObjective('weather_catch', 1);
        this.updateDailyProgress('weather_catch', 1);
      }

      this.updateChapterObjective('catch_count', 1);
      this.updateChapterObjective('catch_rarity', 1, result.rarity);
      this.updateDailyProgress('catch_total', 1);
      this.updateDailyProgress('catch_weight', result.weightKg);
    }
  }

  private onMiss(): void {
    this.economy.resetCatchStreak();
    this.events.emit('streakChanged', { streak: 0, bestStreak: this.economy.bestCatchStreak() });
  }

  private onPerfectCast(): void {
    this.economy.incrementTotalPerfectCasts();
    this.updateChapterObjective('perfect_casts', 1);
    this.updateDailyProgress('perfect_casts', 1);
  }

  private onTrashRecycled(): void {
    this.economy.incrementTotalTrashRecycled();
    this.updateChapterObjective('salvage_count', 1);
    this.updateDailyProgress('salvage', 1);
  }

  private onUpgradePurchased(upgradeId: string): void {
    this.updateChapterObjective('craft_upgrade', 1, upgradeId);
  }

  private onLevelUp(newLevel: number): void {
    this.updateChapterObjective('reach_level', newLevel, undefined, true);
  }

  private onWhaleJump(): void {
    this.updateChapterObjective('whale_jump', 1);
  }

  private onMarketSold(value: number): void {
    this.updateDailyProgress('sell_value', value);
  }

  private unlockRelicForBottle(bottleId?: string): void {
    if (!bottleId) return;

    // Curio Relic discovery association
    const BOTTLE_RELIC_MAP: Record<string, string> = {
      bottle_murmuring_waters: 'relic_brass_compass',
      bottle_barnabys_youth: 'relic_barnaby_pipe',
      bottle_sunken_galleon: 'relic_galleon_doubloon',
      bottle_lighthouse_watch: 'relic_lighthouse_prism',
      bottle_ss_marigold: 'relic_clockwork_heart',
      bottle_abyssal_trench: 'relic_abyssal_pearl',
      bottle_kraken_pact: 'relic_leviathan_tooth',
      bottle_cosmic_meteor: 'relic_starfall_shard',
    };

    const relicId = BOTTLE_RELIC_MAP[bottleId];
    if (relicId && !this.economy.hasDiscoveredRelic(relicId)) {
      this.economy.discoverRelic(relicId);
      const relic = getCurioRelic(relicId);
      if (relic) {
        this.events.emit('curioRelicDiscovered', { relic });
        this.events.emit('toast', { message: `${relic.iconEmoji} Relic Uncovered: ${relic.name}!` });
      }
    }
  }

  private updateChapterObjective(type: string, amount: number, param?: string, isAbsolute = false): void {
    const chapter = this.getActiveChapter();
    if (!chapter) return;

    for (const obj of chapter.objectives) {
      if (obj.type === type) {
        if (param && obj.param) {
          // If rarity, accept equal or higher
          if (type === 'catch_rarity') {
            const tiers = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
            if (tiers.indexOf(param) < tiers.indexOf(obj.param)) continue;
          } else if (obj.id === 'ch2_craft_rod') {
            if (param !== 'carbon-rod' && param !== 'braided-line') continue;
          } else if (param !== obj.param) {
            continue;
          }
        }
        const current = this.getChapterProgress(obj.id);
        const next = isAbsolute ? Math.max(current, amount) : current + amount;
        this.economy.updateChapterProgress(obj.id, next);
      }
    }
  }

  private updateDailyProgress(type: string, amount: number): void {
    const quests = this.getDailyQuests();
    let changed = false;

    for (const q of quests) {
      if (q.type === type && !q.completed) {
        q.progress = Math.min(q.target, Math.round((q.progress + amount) * 10) / 10);
        if (q.progress >= q.target) {
          q.completed = true;
          this.events.emit('toast', { message: `⭐ Daily Quest Complete: ${q.title}!` });
        }
        changed = true;
      }
    }

    if (changed) {
      this.economy.updateDailyQuests(quests);
    }
  }
}
