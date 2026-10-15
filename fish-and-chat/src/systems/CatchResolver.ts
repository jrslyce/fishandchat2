import { calculateFishValue, RARITY_XP_MULTIPLIER, type Rarity, type ThemeId } from '../game/data';
import { pickSpeciesForRarity, pickTrashItem, rollWeightKg } from '../game/loot';
import type { CatchResult } from '../game/events';
import type { Economy } from '../game/Economy';

const TRASH_FLAT_XP = 2;

/**
 * The "catch" is a bag of coins, not a fish — it credits coins immediately and skips the
 * basket entirely, rather than sitting there as an unsellable item. (It used to go through
 * `addToBasket` like a real fish, but `'treasure'` isn't in `FISH_CATALOG`, so `MarketSystem.sell()`
 * silently no-ops on it and the Market list showed the raw id for 0 coins — no way to ever
 * actually get the coins out.)
 */
function resolveTreasureHook(economy: Economy): CatchResult {
  const coins = Math.floor(Math.random() * 50) + 50;
  economy.addCoins(coins);
  return {
    catchId: 'treasure',
    name: 'Sunken Coin Purse',
    rarity: 'epic',
    isTrash: false,
    weightKg: 2.0,
    value: coins,
    flavor: 'A dripping leather bag heavy with coins.',
    xpAwarded: 50,
    addedToBasket: true,
  };
}

/**
 * Special item in a bottle found using the neon lure.
 * Unlocks the Heads-or-Tails Coin Flip game for paid baits!
 */
function resolveLuckyCoinBottleHook(economy: Economy): CatchResult {
  const coins = 100;
  economy.addCoins(coins);
  economy.unlockLuckyCoinBottle();
  economy.recordCatch('lucky-coin-bottle', 0.75, false);
  return {
    catchId: 'lucky-coin-bottle',
    name: 'Lucky Coin in a Bottle',
    rarity: 'epic',
    isTrash: false,
    weightKg: 0.75,
    value: coins,
    flavor: 'Inside the floating bottle is an ancient coin with Barnaby on one side and a pretty catfish on the other! Unlocks the Bait Saver Coin Flip!',
    xpAwarded: 100,
    addedToBasket: true,
  };
}

/**
 * Picks a species for the already-decided `rarity` (respecting theme affinity), computes
 * weight/value/XP, and adds the catch to the basket. Rarity is rolled earlier, at bite-start
 * (`GameState.enterBite()`), so the reel window/fight value can reflect it before the player
 * reacts — this function no longer rolls its own. Does not apply XP — the caller applies
 * `xpAwarded` via `economy.addXp()` so it can react to the returned level-up/theme-change info
 * in the same tick.
 */
export function resolveCatch(
  economy: Economy,
  castPrecisionBonus: number,
  theme: ThemeId,
  L: number,
  S: number,
  rarity: Rarity,
): CatchResult {
  const forced = economy.consumeDebugForcedCatch();
  if (forced === 'treasure') {
    return resolveTreasureHook(economy);
  }
  if (forced === 'lucky-coin-bottle') {
    return resolveLuckyCoinBottleHook(economy);
  }

  const equippedBait = economy.equippedBait();
  if (equippedBait.id === 'neon-super-lure' && !economy.hasLuckyCoinBottle()) {
    if (Math.random() < 0.5) {
      return resolveLuckyCoinBottleHook(economy);
    }
  }

  const effectiveSkill = economy.effectiveSkill(castPrecisionBonus + S * 5);

  if (rarity === 'trash') {
    const trash = pickTrashItem();
    const weightKg = rollWeightKg(trash.weightRangeKg);
    let trashId = trash.id;
    let name = trash.name;
    let value = trash.baseValue;
    if ((L === 4 || L === 7) && Math.random() < 0.5) {
      name = `Salvaged ${name}`;
      value *= 5; // Trash to Treasure
    }
    const addedToBasket = economy.addToTrashBucket({ catchId: trashId, isTrash: true, weightKg, caughtAt: Date.now() });

    return {
      catchId: trash.id,
      name,
      rarity: 'trash',
      isTrash: true,
      weightKg,
      value,
      flavor: trash.flavor,
      xpAwarded: TRASH_FLAT_XP,
      addedToBasket,
    };
  }

  if ((L === 3 || L === 7) && Math.random() < 0.25) {
    return resolveTreasureHook(economy);
  }

  const species = pickSpeciesForRarity(rarity, theme, effectiveSkill);
  const weightKg = rollWeightKg(species.weightRangeKg);
  let value = calculateFishValue(species, weightKg, 1.0);
  let name = species.name;

  if ((L === 5 || L === 7) && Math.random() < 0.25) {
    name = `Golden ${name}`;
    value *= 3;
  }

  const xpAwarded = Math.round(value * RARITY_XP_MULTIPLIER[rarity]);
  const addedToBasket = economy.addToBasket({ catchId: species.id, isTrash: false, weightKg, caughtAt: Date.now() });

  if ((L === 2 || L === 7) && Math.random() < 0.25 && !economy.basketFull()) {
    economy.addToBasket({ catchId: species.id, isTrash: false, weightKg, caughtAt: Date.now() });
    name = `${name} (Double Catch!)`;
  }

  return {
    catchId: species.id,
    name,
    rarity,
    isTrash: false,
    weightKg,
    value,
    flavor: species.flavor,
    xpAwarded,
    addedToBasket,
  };
}
