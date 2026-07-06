import { FISHBOT_CATALOG, type MaterialId, type UpgradeId } from './data';

export interface BasketItem {
  /** FISH_CATALOG id, TRASH_CATALOG id, or a fishbot-caught species id. */
  catchId: string;
  isTrash: boolean;
  weightKg: number;
  caughtAt: number;
}

export interface FishbotState {
  owned: boolean;
  nextReadyAtMs: number;
}

export interface GameSaveStateV1 {
  coins: number;
  level: number;
  xp: number;
  basket: BasketItem[];
  materials: Record<MaterialId, number>;
  upgrades: Partial<Record<UpgradeId, number>>;
  equippedBaitId: string;
  baitInventory: Record<string, number>;
  discoveredCatchIds: string[];
  fishbots: Record<string, FishbotState>;
  fishbotHopper: BasketItem[];
  lastActiveAtMs: number;
  audio: { master: number; sfx: number; ambience: number; muted: boolean };
  luckyDuckyCount: number;
  luckyDuckyExpiresAtMs: number;
}

export function createDefaultSaveState(): GameSaveStateV1 {
  const fishbots: Record<string, FishbotState> = {};
  for (const bot of FISHBOT_CATALOG) {
    fishbots[bot.id] = { owned: false, nextReadyAtMs: 0 };
  }

  return {
    coins: 50,
    level: 1,
    xp: 0,
    basket: [],
    materials: { rubber: 0, metal: 0, wood: 0, fabric: 0, fiber: 0, glass: 0 },
    upgrades: {},
    equippedBaitId: 'pleb-bait',
    baitInventory: {},
    discoveredCatchIds: [],
    fishbots,
    fishbotHopper: [],
    lastActiveAtMs: Date.now(),
    audio: { master: 1, sfx: 0.8, ambience: 0.6, muted: false },
    luckyDuckyCount: 0,
    luckyDuckyExpiresAtMs: 0,
  };
}
