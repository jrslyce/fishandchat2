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
  /** Trash is uncapped and kept separate from the basket so junk never competes with fish for room. */
  trashBucket: BasketItem[];
  materials: Record<MaterialId, number>;
  upgrades: Partial<Record<UpgradeId, number>>;
  equippedBaitId: string;
  baitInventory: Record<string, number>;
  discoveredCatchIds: string[];
  fishbots: Record<string, FishbotState>;
  /** Only one fishbot works the dock at a time — swapping is how you trade Mk II's better odds for Mk I's trash-inclusive bias (e.g. to farm crafting materials). */
  equippedFishbotId: string | null;
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
  /** One-time Barnaby tutorial bubbles — dismissed permanently once the player has cast/reeled once. */
  hasSeenCastTutorial: boolean;
  hasSeenReelTutorial: boolean;
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
    trashBucket: [],
    materials: { rubber: 0, metal: 0, wood: 0, fabric: 0, fiber: 0, glass: 0 },
    upgrades: {},
    equippedBaitId: 'pleb-bait',
    baitInventory: {},
    discoveredCatchIds: [],
    fishbots,
    equippedFishbotId: null,
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
    hasSeenCastTutorial: false,
    hasSeenReelTutorial: false,
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

  // Saves from before the trash/basket split predate this field entirely.
  if (next.trashBucket === undefined) {
    next = { ...next, trashBucket: [] };
  }

  // Saves from before the split also have trash items still sitting in the basket
  // (mixed in with fish) — move them over so they stop showing up as sellable.
  if (next.basket.some((item) => item.isTrash)) {
    next = {
      ...next,
      basket: next.basket.filter((item) => !item.isTrash),
      trashBucket: [...next.trashBucket, ...next.basket.filter((item) => item.isTrash)],
    };
  }

  // Saves from before the tap-to-cast tutorial predate these fields — an existing player
  // already knows how to play, so default them to "seen" rather than surfacing the popups.
  if (next.hasSeenCastTutorial === undefined || next.hasSeenReelTutorial === undefined) {
    next = {
      ...next,
      hasSeenCastTutorial: next.hasSeenCastTutorial ?? true,
      hasSeenReelTutorial: next.hasSeenReelTutorial ?? true,
    };
  }

  // Saves from before fishbots became single-active predate this field — older saves could
  // have both Mk I and Mk II owned and ticking at once. Preserve auto-fishing for these
  // players by equipping their best owned bot (Mk II over Mk I) rather than dropping them
  // to nothing-equipped.
  if (next.equippedFishbotId === undefined) {
    const ownedIds = FISHBOT_CATALOG.filter((bot) => next.fishbots[bot.id]?.owned).map((bot) => bot.id);
    next = { ...next, equippedFishbotId: ownedIds.includes('fishbot-mk2') ? 'fishbot-mk2' : (ownedIds[0] ?? null) };
  }

  return next;
}
