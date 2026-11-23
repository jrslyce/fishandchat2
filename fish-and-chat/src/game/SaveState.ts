import { FISHBOT_CATALOG, type ArchetypeId, type ClothingSlot, type MaterialId, type UpgradeId } from './data';
import type { DailyQuest } from './StoryGoals';

export interface BasketItem {
  /** FISH_CATALOG id, TRASH_CATALOG id, or a fishbot-caught species id. */
  catchId: string;
  isTrash: boolean;
  weightKg: number;
  caughtAt: number;
  golden?: boolean;
  protectedCatch?: boolean;
  sourceBotId?: string;
}

export interface FishbotState {
  owned: boolean;
  nextReadyAtMs: number;
  hopperTier?: number;
  autoUnload?: boolean;
  mode?: 'balanced' | 'salvage' | 'trophy';
  unlockedModes?: ('salvage' | 'trophy')[];
}

export interface FishRecord {
  count: number;
  maxWeightKg: number;
}

export interface ChannelCandyWallet {
  name: string;
  avatarUrl: string | null;
  balance: number;
  activity: Array<{ at: number; delta: number; reason?: string }>;
}

export type CosmeticSlot = 'rod' | 'fishbot' | 'trail';

export interface OutfitPreset {
  name: string;
  clothing: Record<ClothingSlot, string | null>;
  baseToneId: string;
  cosmetics: Record<CosmeticSlot, string | null>;
}

export interface GameSaveStateV1 {
  coins: number;
  candyBars: number;
  activeChannelId?: string;
  channelCandyWallets?: Record<string, ChannelCandyWallet>;
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
  fishRecords: Record<string, FishRecord>;
  fishbots: Record<string, FishbotState>;
  fishbotHopper: BasketItem[];
  autoSellRarities?: string[];
  sorterTrayOwned?: boolean;
  autoSaleCount?: number;
  autoSaleCoins?: number;
  lastActiveAtMs: number;
  audio: { master: number; sfx: number; ambience: number; muted: boolean };
  luckyDuckyCount: number;
  luckyDuckyExpiresAtMs: number;
  ownedPremiumItemIds: string[];
  ownedClothingIds: string[];
  equippedClothing: Record<ClothingSlot, string | null>;
  equippedCosmetics: Record<CosmeticSlot, string | null>;
  outfitPresets: Array<OutfitPreset | null>;
  baseToneId: string;
  displayNameOverride: string | null;
  skillPoints: number;
  archetypePoints: Record<ArchetypeId, number>;
  /** One-time Barnaby tutorial bubbles — dismissed permanently once the player has cast/reeled once. */
  hasSeenCastTutorial: boolean;
  hasSeenReelTutorial: boolean;
  seenWeatherClothingTipIds?: string[];
  /** Progress through the 2-cast pleb bait onboarding tutorial (0 = cast 1, 1 = cast 2, 2 = casts done) */
  tutorialCastCount: number;
  /** Whether the full bait onboarding tutorial (dialogue + bait shop prompt) has finished */
  hasCompletedBaitTutorial: boolean;
  /** Whether the player has fished up the Lucky Coin in a Bottle with the neon lure */
  hasLuckyCoinBottle: boolean;
  prestige: number;
  catchStreak: number;
  bestCatchStreak: number;
  activeStoryChapter: number;
  storyProgress: Record<string, number>;
  completedChapterIds: string[];
  dailyQuests: DailyQuest[];
  lastDailyQuestRefreshMs: number;
  claimedMilestoneIds: string[];
  activeStreamBuffs: Record<string, number>;
  totalFishCaught: number;
  totalWeightKgCaught: number;
  totalTrashRecycled: number;
  totalPerfectCasts: number;
  equippedTitle: string | null;
  unlockedTitles: string[];
  activeCommunityGoalId?: string;
  communityGoalProgress?: number;
  completedCommunityGoalIds?: string[];
  totalCommunityGoalsCompleted?: number;
  discoveredBottleIds?: string[];
  discoveredRelicIds?: string[];
}

export function createDefaultSaveState(): GameSaveStateV1 {
  const fishbots: Record<string, FishbotState> = {};
  for (const bot of FISHBOT_CATALOG) {
    fishbots[bot.id] = { owned: false, nextReadyAtMs: 0 };
  }

  return {
    coins: 50,
    candyBars: 0,
    activeChannelId: 'local',
    channelCandyWallets: {},
    level: 1,
    xp: 0,
    basket: [],
    trashBucket: [],
    materials: { rubber: 0, metal: 0, wood: 0, fabric: 0, fiber: 0, glass: 0 },
    upgrades: {},
    equippedBaitId: 'pleb-bait',
    baitInventory: {},
    discoveredCatchIds: [],
    fishRecords: {},
    fishbots,
    fishbotHopper: [],
    lastActiveAtMs: Date.now(),
    audio: { master: 1, sfx: 0.8, ambience: 0.6, muted: true },
    luckyDuckyCount: 0,
    luckyDuckyExpiresAtMs: 0,
    ownedPremiumItemIds: [],
    ownedClothingIds: ['basic-shirt', 'basic-pants', 'basic-shoes'],
    equippedClothing: { hat: null, jacket: 'basic-shirt', pants: 'basic-pants', shoes: 'basic-shoes' },
    equippedCosmetics: { rod: null, fishbot: null, trail: null },
    outfitPresets: [null, null, null],
    baseToneId: 'sunfish-tan',
    displayNameOverride: null,
    skillPoints: 0,
    archetypePoints: { brawler: 0, patience: 0, trapper: 0, charmer: 0, tactician: 0 },
    hasSeenCastTutorial: false,
    hasSeenReelTutorial: false,
    seenWeatherClothingTipIds: [],
    tutorialCastCount: 0,
    hasCompletedBaitTutorial: false,
    hasLuckyCoinBottle: false,
    prestige: 0,
    catchStreak: 0,
    bestCatchStreak: 0,
    activeStoryChapter: 1,
    storyProgress: {},
    completedChapterIds: [],
    dailyQuests: [],
    lastDailyQuestRefreshMs: 0,
    claimedMilestoneIds: [],
    activeStreamBuffs: {},
    totalFishCaught: 0,
    totalWeightKgCaught: 0,
    totalTrashRecycled: 0,
    totalPerfectCasts: 0,
    equippedTitle: null,
    unlockedTitles: [],
    activeCommunityGoalId: 'ancient-leviathan',
    communityGoalProgress: 0,
    completedCommunityGoalIds: [],
    totalCommunityGoalsCompleted: 0,
    discoveredBottleIds: [],
    discoveredRelicIds: [],
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

  if (!next.equippedCosmetics || !next.outfitPresets) {
    next = {
      ...next,
      equippedCosmetics: next.equippedCosmetics ?? { rod: null, fishbot: null, trail: null },
      outfitPresets: next.outfitPresets ?? [null, null, null],
    };
  }

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

  // Saves from before the pleb bait tutorial predate these fields — default existing players
  // who already completed the earlier tutorial or caught fish to completed.
  if (next.tutorialCastCount === undefined || next.hasCompletedBaitTutorial === undefined) {
    const isExisting = (next.hasSeenCastTutorial && next.hasSeenReelTutorial) || (next.basket && next.basket.length > 0) || next.level > 1;
    next = {
      ...next,
      tutorialCastCount: next.tutorialCastCount ?? (isExisting ? 2 : 0),
      hasCompletedBaitTutorial: next.hasCompletedBaitTutorial ?? isExisting,
    };
  }

  // Backfill fishRecords for scrap book tracking if missing
  if (next.fishRecords === undefined) {
    const records: Record<string, FishRecord> = {};
    if (next.basket) {
      for (const item of next.basket) {
        if (item.isTrash) continue;
        const cur = records[item.catchId] ?? { count: 0, maxWeightKg: 0 };
        records[item.catchId] = {
          count: cur.count + 1,
          maxWeightKg: Math.max(cur.maxWeightKg, item.weightKg),
        };
      }
    }
    next = { ...next, fishRecords: records };
  }

  if (next.hasLuckyCoinBottle === undefined) {
    next = { ...next, hasLuckyCoinBottle: false };
  }

  if (next.prestige === undefined) next = { ...next, prestige: 0 };
  if (next.catchStreak === undefined) next = { ...next, catchStreak: 0 };
  if (next.bestCatchStreak === undefined) next = { ...next, bestCatchStreak: 0 };
  if (next.activeStoryChapter === undefined) next = { ...next, activeStoryChapter: 1 };
  if (next.storyProgress === undefined) next = { ...next, storyProgress: {} };
  if (next.completedChapterIds === undefined) next = { ...next, completedChapterIds: [] };
  if (next.dailyQuests === undefined) next = { ...next, dailyQuests: [] };
  if (next.lastDailyQuestRefreshMs === undefined) next = { ...next, lastDailyQuestRefreshMs: 0 };
  if (next.claimedMilestoneIds === undefined) next = { ...next, claimedMilestoneIds: [] };
  if (next.activeStreamBuffs === undefined) next = { ...next, activeStreamBuffs: {} };
  if (next.totalFishCaught === undefined) {
    let count = 0;
    let weight = 0;
    if (next.fishRecords) {
      for (const rec of Object.values(next.fishRecords)) {
        count += rec.count;
        weight += rec.count * rec.maxWeightKg * 0.8;
      }
    }
    next = { ...next, totalFishCaught: count, totalWeightKgCaught: Math.round(weight * 10) / 10 };
  }
  if (next.totalTrashRecycled === undefined) next = { ...next, totalTrashRecycled: 0 };
  if (next.totalPerfectCasts === undefined) next = { ...next, totalPerfectCasts: 0 };
  if (next.equippedTitle === undefined) next = { ...next, equippedTitle: null };
  if (next.unlockedTitles === undefined) next = { ...next, unlockedTitles: [] };
  if (next.activeCommunityGoalId === undefined) next = { ...next, activeCommunityGoalId: 'ancient-leviathan' };
  if (next.communityGoalProgress === undefined) next = { ...next, communityGoalProgress: 0 };
  if (next.completedCommunityGoalIds === undefined) next = { ...next, completedCommunityGoalIds: [] };
  if (next.totalCommunityGoalsCompleted === undefined) next = { ...next, totalCommunityGoalsCompleted: 0 };
  if (next.discoveredBottleIds === undefined) next = { ...next, discoveredBottleIds: [] };
  if (next.discoveredRelicIds === undefined) next = { ...next, discoveredRelicIds: [] };

  return next;
}
