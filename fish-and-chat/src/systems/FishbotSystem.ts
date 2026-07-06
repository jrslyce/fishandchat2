import type { FishbotDefinition, ThemeId } from '../game/data';
import { pickRandom, pickSpeciesForRarity, pickTrashItem, rollWeightKg } from '../game/loot';
import type { Economy } from '../game/Economy';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';

const OFFLINE_PROGRESS_CAP_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_OFFLINE_TICKS_PER_BOT = 200; // safety backstop, not a real gameplay limit

export class FishbotSystem {
  constructor(
    private readonly economy: Economy,
    private readonly events: EventBus<GameEventMap>,
  ) {}

  /** Call once at startup, before the render loop begins. */
  simulateOfflineProgress(theme: ThemeId): void {
    const lastActive = this.economy.lastActiveAtMs();
    const now = Date.now();
    const horizon = Math.min(now, lastActive + OFFLINE_PROGRESS_CAP_MS);
    if (horizon <= lastActive) return;

    let claimed = 0;
    for (const bot of this.economy.ownedFishbots()) {
      const state = this.economy.fishbotState(bot.id);
      if (!state) continue;

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
    }

    if (claimed > 0) this.events.emit('toast', { message: `Your fishbots caught ${claimed} while you were away.` });
  }

  /** Call every frame. */
  update(nowMs: number, theme: ThemeId): void {
    for (const bot of this.economy.ownedFishbots()) {
      const state = this.economy.fishbotState(bot.id);
      if (!state) continue;
      if (nowMs < state.nextReadyAtMs) continue;

      const intervalMs = bot.baseIntervalSeconds * 1000 * this.economy.fishbotIntervalMultiplier();
      if (!this.economy.hopperFull()) {
        this.depositCatch(bot, theme);
      }
      this.economy.setFishbotNextReady(bot.id, nowMs + intervalMs);
    }
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
    const species = pickSpeciesForRarity(rarity, theme);
    this.economy.addToHopper({ catchId: species.id, isTrash: false, weightKg: rollWeightKg(species.weightRangeKg), caughtAt: Date.now() });
  }
}
