import type { ArchetypeId, ClothingSlot, Rarity, ThemeId, UpgradeId } from './data';
import type { FishingPhase } from './GameState';
import type { LevelUpResult } from './Economy';
import type { RecycleResult } from './Economy';
import type { LoreBottle } from './LoreBottles';
import type { CurioRelic } from './RelicSystem';
import type { CosmeticSlot } from './SaveState';

export interface CatchResult {
  catchId: string;
  name: string;
  rarity: Rarity;
  isTrash: boolean;
  weightKg: number;
  value: number;
  flavor: string;
  xpAwarded: number;
  addedToBasket: boolean;
}

export interface GameEventMap {
  actionPressed: Record<string, never>;
  actionReleased: { heldSeconds: number };
  fishbotToggled: { enabled: boolean; name: string };

  phaseChanged: { phase: FishingPhase };
  castLocked: { precision: number; rolls: { L: number; T: number; S: number } };
  biteStarted: { rarity: Rarity; fightValue: number; skillValue: number };
  biteReacted: { success: boolean };
  catchResolved: { result: CatchResult };
  coinTossTriggered: { baitId: string; baitName: string };
  patienceBonusAwarded: Record<string, never>;
  trashRecycled: { result: RecycleResult; catchId: string };
  recycleFinished: { successCount: number; failCount: number; salvaged: Record<string, number> };
  missed: { reason: 'early' | 'late' | 'no-react' | 'escaped' | 'no-catch' | 'bait-stolen' | 'reeled-early' };
  basketFull: Record<string, never>;

  xpGained: { amount: number } & LevelUpResult;
  coinsChanged: Record<string, never>;
  candyBarsChanged: Record<string, never>;

  premiumItemPurchased: { id: string; ok: boolean };
  materialBundlePurchased: { id: string; ok: boolean };
  boxOfNotFishOpened: { ok: boolean; itemsGranted: number };

  marketSold: { catchId: string; value: number; method?: string; success?: boolean };

  upgradePurchased: { id: UpgradeId; ok: boolean };
  skillPointSpent: { id: ArchetypeId; ok: boolean };
  baitPurchased: { id: string; ok: boolean };
  baitEquipped: { id: string };

  fishbotPurchased: { id: string; ok: boolean };
  fishbotClaimed: { count: number };

  themeChanged: { theme: ThemeId };
  toast: { message: string };

  clothingPurchased: { id: string; ok: boolean };
  clothingEquipped: { slot: ClothingSlot; id: string | null };
  clothingPreviewChanged: { id: string | null };
  cosmeticEquipped: { slot: CosmeticSlot; id: string | null };
  baseToneChanged: { id: string };
  characterGenderChanged: { gender: 'male' | 'female' };
  displayNameChanged: { name: string };
  closetOpened: Record<string, never>;
  closetClosed: Record<string, never>;

  twitchIdentityResolved: { displayName: string };

  weatherChanged: { weather: string };
  whaleJump: { position?: { x: number; y: number; z: number } };
  krakenBreach: { position?: { x: number; y: number; z: number } };
  streakChanged: { streak: number; bestStreak: number };
  questCompleted: { questId: string; title: string; reward: { coins: number; xp: number; candyBars?: number } };
  chapterCompleted: { chapterNumber: number; title: string; titleReward?: string };
  milestoneClaimed: { milestoneId: string; name: string; reward: { coins: number; xp: number; candyBars?: number } };
  streamBuffActivated: { buffId: string; name: string; durationSeconds: number; triggeredBy?: string };
  communityGoalCompleted: { goalId: string; name: string; rewards: { coins: number; xp: number; candyBars: number; title: string } };
  communityProgressUpdated: { goalId: string; current: number; target: number; contributor?: string };
  bottleTapped: { bottleId: string; position?: { x: number; y: number; z: number } };
  loreBottleDiscovered: { bottle: LoreBottle; bottleId?: string };
  curioRelicDiscovered: { relic: CurioRelic };
}
