import type { ArchetypeId, ClothingSlot, Rarity, ThemeId, UpgradeId } from './data';
import type { FishingPhase } from './GameState';
import type { LevelUpResult } from './Economy';
import type { RecycleResult } from './Economy';

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

  marketSold: { catchId: string; value: number; method: 'sell' | 'haggle' | 'desperate'; success: boolean };
  marketBonesDepleted: Record<string, never>;

  upgradePurchased: { id: UpgradeId; ok: boolean };
  skillPointSpent: { id: ArchetypeId; ok: boolean };
  baitPurchased: { id: string; ok: boolean };
  baitEquipped: { id: string };

  fishbotPurchased: { id: string; ok: boolean };
  fishbotEquipped: { id: string };
  fishbotClaimed: { count: number };

  themeChanged: { theme: ThemeId };
  toast: { message: string };

  clothingPurchased: { id: string; ok: boolean };
  clothingEquipped: { slot: ClothingSlot; id: string | null };
  baseToneChanged: { id: string };
  displayNameChanged: { name: string };
  closetOpened: Record<string, never>;
  closetClosed: Record<string, never>;

  twitchIdentityResolved: { displayName: string };
}
