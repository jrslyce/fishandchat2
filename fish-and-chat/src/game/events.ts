import type { Rarity, ThemeId, UpgradeId } from './data';
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

  phaseChanged: { phase: FishingPhase };
  castLocked: { precision: number; rolls: { L: number; T: number; S: number } };
  biteStarted: Record<string, never>;
  biteReacted: { success: boolean };
  catchResolved: { result: CatchResult };
  patienceBonusAwarded: Record<string, never>;
  trashRecycled: { result: RecycleResult; catchId: string };
  recycleFinished: { successCount: number; failCount: number; salvaged: Record<string, number> };
  missed: { reason: 'early' | 'late' | 'no-react' };
  basketFull: Record<string, never>;

  xpGained: { amount: number } & LevelUpResult;
  coinsChanged: Record<string, never>;

  marketSold: { catchId: string; value: number; method: 'sell' | 'haggle' | 'desperate'; success: boolean };
  marketBonesDepleted: Record<string, never>;

  upgradePurchased: { id: UpgradeId; ok: boolean };
  baitPurchased: { id: string; ok: boolean };
  baitEquipped: { id: string };

  fishbotPurchased: { id: string; ok: boolean };
  fishbotClaimed: { count: number };

  themeChanged: { theme: ThemeId };
  toast: { message: string };
}
