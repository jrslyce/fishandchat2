import { RARITY_XP_MULTIPLIER, computeRarityWeights, rollRarity, type ThemeId } from '../game/data';
import { pickSpeciesForRarity, pickTrashItem, rollWeightKg } from '../game/loot';
import type { CatchResult } from '../game/events';
import type { Economy } from '../game/Economy';

const TRASH_FLAT_XP = 2;

/**
 * Rolls a rarity, picks a species (respecting theme affinity), computes
 * weight/value/XP, and adds the catch to the basket. Does not apply XP —
 * the caller applies `xpAwarded` via `economy.addXp()` so it can react to
 * the returned level-up/theme-change info in the same tick.
 */
export function resolveCatch(economy: Economy, castPrecisionBonus: number, theme: ThemeId, L: number, S: number): CatchResult {
  const effectiveSkill = economy.effectiveSkill(castPrecisionBonus + S * 5);
  const weights = computeRarityWeights(effectiveSkill, economy.hasSonarScanner());
  const rarity = rollRarity(weights);

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
    const addedToBasket = economy.addToBasket({ catchId: trashId, isTrash: true, weightKg, caughtAt: Date.now() });

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
    // Treasure Hook
    const coins = Math.floor(Math.random() * 50) + 50;
    return {
      catchId: 'treasure',
      name: 'Sunken Coin Purse',
      rarity: 'epic',
      isTrash: false,
      weightKg: 2.0,
      value: coins,
      flavor: 'A dripping leather bag heavy with coins.',
      xpAwarded: 50,
      addedToBasket: false, // auto-sell? or goes in basket? let's put it in basket so they can sell it.
    };
  }

  const species = pickSpeciesForRarity(rarity, theme, effectiveSkill);
  const weightKg = rollWeightKg(species.weightRangeKg);
  let value = species.baseValue;
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
