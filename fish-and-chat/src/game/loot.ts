import { FISH_CATALOG, TRASH_CATALOG, type CatchDefinition, type Rarity, type ThemeId, type TrashDefinition } from './data';

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function rollWeightKg(range: [number, number]): number {
  const [min, max] = range;
  return min + (max - min) * Math.pow(Math.random(), 0.7);
}

export function pickTrashItem(): TrashDefinition {
  return pickRandom(TRASH_CATALOG);
}

/** Picks a species of the given rarity, preferring ones affine to the current theme, and filtering by required skill. */
export function pickSpeciesForRarity(rarity: Exclude<Rarity, 'trash'>, theme: ThemeId, effectiveSkill: number = 0): CatchDefinition {
  const candidates = FISH_CATALOG.filter(
    (fish) => fish.rarity === rarity && 
              (!fish.themeAffinity || fish.themeAffinity.includes(theme)) &&
              (!fish.minSkill || effectiveSkill >= fish.minSkill)
  );
  let pool = candidates.length > 0 ? candidates : FISH_CATALOG.filter((fish) => fish.rarity === rarity && (!fish.minSkill || effectiveSkill >= fish.minSkill));
  
  if (pool.length === 0) {
    pool = FISH_CATALOG.filter((fish) => fish.rarity === rarity);
  }
  
  return pickRandom(pool);
}
