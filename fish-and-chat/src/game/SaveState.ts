import { FISHBOT_CATALOG, type ArchetypeId, type ClothingSlot, type MaterialId, type UpgradeId } from './data';

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
  candyBars: number;
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
  ownedPremiumItemIds: string[];
  ownedClothingIds: string[];
  equippedClothing: Record<ClothingSlot, string | null>;
  baseToneId: string;
  displayNameOverride: string | null;
  skillPoints: number;
  archetypePoints: Record<ArchetypeId, number>;
}

export function createDefaultSaveState(): GameSaveStateV1 {
  const fishbots: Record<string, FishbotState> = {};
  for (const bot of FISHBOT_CATALOG) {
    fishbots[bot.id] = { owned: false, nextReadyAtMs: 0 };
  }

  return {
    coins: 50,
    candyBars: 0,
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
    ownedPremiumItemIds: [],
    ownedClothingIds: ['basic-shirt', 'basic-pants', 'basic-shoes'],
    equippedClothing: { hat: null, jacket: 'basic-shirt', pants: 'basic-pants', shoes: 'basic-shoes' },
    baseToneId: 'sunfish-tan',
    displayNameOverride: null,
    skillPoints: 0,
    archetypePoints: { brawler: 0, patience: 0, trapper: 0, charmer: 0, tactician: 0 },
  };
}

/**
 * Backfills saves made between the character system landing and the starter-outfit
 * commit — those saves are already SAVE_VERSION 3 (so SaveManager doesn't discard them)
 * but have `equippedClothing` left all-null from before basic-shirt/pants/shoes existed
 * as defaults, so the angler renders bare forever. Grants the same free basics a brand
 * new save starts with. Only touches saves with nothing equipped in those three slots —
 * a save with any intentional loadout (even just a jacket) is left alone.
 */
export function migrateSaveState(state: GameSaveStateV1): GameSaveStateV1 {
  let next = state;

  const { jacket, pants, shoes } = next.equippedClothing;
  if (!jacket && !pants && !shoes) {
    const starterIds = ['basic-shirt', 'basic-pants', 'basic-shoes'];
    next = {
      ...next,
      ownedClothingIds: Array.from(new Set([...next.ownedClothingIds, ...starterIds])),
      equippedClothing: { ...next.equippedClothing, jacket: 'basic-shirt', pants: 'basic-pants', shoes: 'basic-shoes' },
    };
  }

  // Saves from before the fight/skill-point system predate these fields entirely.
  if (next.skillPoints === undefined || next.archetypePoints === undefined) {
    next = {
      ...next,
      skillPoints: next.skillPoints ?? 0,
      archetypePoints: next.archetypePoints ?? { brawler: 0, patience: 0, trapper: 0, charmer: 0, tactician: 0 },
    };
  }

  return next;
}
