export type Rarity = 'trash' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ThemeId = 'forest-pond' | 'ocean-trench' | 'cosmic-lake';
export type MaterialId = 'rubber' | 'metal' | 'wood' | 'fabric' | 'fiber' | 'glass';

export const RARITY_ORDER: Rarity[] = ['trash', 'common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY_XP_MULTIPLIER: Record<Rarity, number> = {
  trash: 0.2,
  common: 1,
  uncommon: 1.5,
  rare: 3,
  epic: 6,
  legendary: 12,
};

export interface CatchDefinition {
  id: string;
  name: string;
  rarity: Rarity;
  weightRangeKg: [number, number];
  baseValue: number;
  flavor: string;
  themeAffinity?: ThemeId[];
  minSkill?: number;
}

export interface TrashDefinition {
  id: string;
  name: string;
  weightRangeKg: [number, number];
  baseValue: number;
  flavor: string;
  recyclesInto: MaterialId;
}

export const FISH_CATALOG: CatchDefinition[] = [
  // common
  { id: 'sunny-perch', name: 'Sunny Perch', rarity: 'common', weightRangeKg: [0.2, 0.6], baseValue: 6, flavor: 'A cheerful little perch that always seems to be smiling.' },
  { id: 'pond-minnow', name: 'Pond Minnow', rarity: 'common', weightRangeKg: [0.05, 0.15], baseValue: 4, flavor: 'Quick, silvery, and everywhere you look.' },
  { id: 'mudskip-carp', name: 'Mudskip Carp', rarity: 'common', weightRangeKg: [0.8, 1.6], baseValue: 8, flavor: 'Prefers the muddy shallows and a slow afternoon.' },
  { id: 'blue-gill', name: 'Blue Gill', rarity: 'common', weightRangeKg: [0.15, 0.4], baseValue: 5, flavor: 'Its fins catch the light like tiny stained glass.' },
  { id: 'speckled-dace', name: 'Speckled Dace', rarity: 'common', weightRangeKg: [0.1, 0.3], baseValue: 5, flavor: 'Covered in freckles it is very proud of.' },
  // uncommon
  { id: 'copper-trout', name: 'Copper Trout', rarity: 'uncommon', weightRangeKg: [0.6, 1.4], baseValue: 18, flavor: 'Scales the color of an old penny left in the sun.' },
  { id: 'lantern-catfish', name: 'Lantern Catfish', rarity: 'uncommon', weightRangeKg: [1.2, 2.8], baseValue: 22, flavor: 'A faint glow follows its whiskers after dusk.' },
  { id: 'jade-koi', name: 'Jade Koi', rarity: 'uncommon', weightRangeKg: [0.5, 1.1], baseValue: 24, flavor: 'Ornamental, opinionated, and slightly smug about it.' },
  { id: 'pebble-bass', name: 'Pebble Bass', rarity: 'uncommon', weightRangeKg: [0.9, 2.0], baseValue: 20, flavor: 'Named for the way it sits stubbornly on the bottom.' },
  { id: 'silver-shad', name: 'Silver Shad', rarity: 'uncommon', weightRangeKg: [0.3, 0.7], baseValue: 16, flavor: 'Travels in loose, friendly little schools.' },
  // rare
  { id: 'moonlit-eel', name: 'Moonlit Eel', rarity: 'rare', weightRangeKg: [1.0, 2.4], baseValue: 60, flavor: 'Only bites when the water is calm and the sky is clear.', themeAffinity: ['forest-pond', 'cosmic-lake'] },
  { id: 'coral-clownfish', name: 'Coral Clownfish', rarity: 'rare', weightRangeKg: [0.1, 0.3], baseValue: 55, flavor: 'Loud colors for such a small, polite fish.', themeAffinity: ['ocean-trench'] },
  { id: 'glassfin-pike', name: 'Glassfin Pike', rarity: 'rare', weightRangeKg: [1.5, 3.2], baseValue: 65, flavor: 'Fins so clear you can see the pond through them.' },
  { id: 'sapphire-tuna', name: 'Sapphire Tuna', rarity: 'rare', weightRangeKg: [2.0, 4.0], baseValue: 70, flavor: 'A deep-water visitor, far from home.', themeAffinity: ['ocean-trench', 'cosmic-lake'] },
  // epic
  { id: 'starlit-anglerfish', name: 'Starlit Anglerfish', rarity: 'epic', weightRangeKg: [1.0, 2.2], baseValue: 160, flavor: 'Its lure blinks in slow, patient patterns.', themeAffinity: ['ocean-trench', 'cosmic-lake'] },
  { id: 'golden-arowana', name: 'Golden Arowana', rarity: 'epic', weightRangeKg: [1.8, 3.6], baseValue: 175, flavor: 'Considered good luck by everyone who has never caught one.' },
  { id: 'aurora-jelly', name: 'Aurora Jellyfish', rarity: 'epic', weightRangeKg: [0.4, 1.0], baseValue: 150, flavor: 'Pulses gently with color like a slow heartbeat.', themeAffinity: ['cosmic-lake'] },
  // legendary
  { id: 'prism-koi', name: 'Prism Koi', rarity: 'legendary', weightRangeKg: [2.5, 5.0], baseValue: 500, flavor: 'Every scale throws a different color of light.' },
  { id: 'void-leviathan-pup', name: 'Void Leviathan Pup', rarity: 'legendary', weightRangeKg: [3.0, 6.0], baseValue: 620, flavor: 'Impossibly small for something that big someday.', themeAffinity: ['cosmic-lake'] },
  { id: 'tidecaller-marlin', name: 'Tidecaller Marlin', rarity: 'legendary', weightRangeKg: [4.0, 8.0], baseValue: 580, flavor: 'Old dock stories say it answers to its own name.', themeAffinity: ['ocean-trench'] },
  // make-believe
  { id: 'stardust-guppy', name: 'Stardust Guppy', rarity: 'rare', weightRangeKg: [0.1, 0.5], baseValue: 150, flavor: 'A tiny fish that sparkles like the night sky. Requires great skill to catch.', minSkill: 15 },
  { id: 'nebula-ray', name: 'Nebula Ray', rarity: 'epic', weightRangeKg: [5.0, 15.0], baseValue: 350, flavor: 'It glides through the water as if flying through deep space.', minSkill: 20 },
  { id: 'chrono-carp', name: 'Chrono Carp', rarity: 'epic', weightRangeKg: [2.0, 8.0], baseValue: 500, flavor: 'A fish that seems to swim slightly out of sync with time itself.', minSkill: 25 },
  { id: 'void-bass', name: 'Void Bass', rarity: 'legendary', weightRangeKg: [10.0, 25.0], baseValue: 1000, flavor: 'Staring into its scales reveals the endless abyss. Extremely hard to catch.', minSkill: 30 },
  { id: 'quantum-leviathan', name: 'Quantum Leviathan', rarity: 'legendary', weightRangeKg: [100.0, 500.0], baseValue: 5000, flavor: 'A legendary beast that exists in multiple states at once. Only the absolute best anglers can land it.', minSkill: 35 },
];

export const TRASH_CATALOG: TrashDefinition[] = [
  { id: 'old-boot', name: 'Old Boot', weightRangeKg: [0.4, 0.9], baseValue: 1, flavor: 'Someone, somewhere, is missing this.', recyclesInto: 'rubber' },
  { id: 'tin-can', name: 'Tin Can', weightRangeKg: [0.05, 0.15], baseValue: 1, flavor: 'Empty. Has been for a while.', recyclesInto: 'metal' },
  { id: 'driftwood', name: 'Driftwood Chunk', weightRangeKg: [0.3, 0.8], baseValue: 1, flavor: 'Smooth, weathered, and pleasantly warm in the sun.', recyclesInto: 'wood' },
  { id: 'soggy-hat', name: 'Soggy Hat', weightRangeKg: [0.1, 0.2], baseValue: 1, flavor: 'Once someone’s pride and joy.', recyclesInto: 'fabric' },
  { id: 'tangled-line', name: 'Tangled Fishing Line', weightRangeKg: [0.02, 0.05], baseValue: 1, flavor: 'A cautionary tale, knotted into a ball.', recyclesInto: 'fiber' },
  { id: 'glass-bottle', name: 'Glass Bottle', weightRangeKg: [0.2, 0.4], baseValue: 1, flavor: 'No message inside. Just algae.', recyclesInto: 'glass' },
];

export interface BaitDefinition {
  id: string;
  name: string;
  costPerTen: number;
  waitMultiplier: number;
  skillBonus: number;
  free?: boolean;
}

export const BAIT_CATALOG: BaitDefinition[] = [
  { id: 'pleb-bait', name: 'Pleb Bait', costPerTen: 0, waitMultiplier: 1.0, skillBonus: 0, free: true },
  { id: 'marshmallows', name: 'Marshmallows', costPerTen: 25, waitMultiplier: 0.85, skillBonus: 15 },
  { id: 'nightcrawlers', name: 'Nightcrawlers', costPerTen: 100, waitMultiplier: 0.75, skillBonus: 25 },
  { id: 'neon-super-lure', name: 'Neon Super Lure', costPerTen: 500, waitMultiplier: 0.5, skillBonus: 50 },
];

export type UpgradeId =
  | 'carbon-rod'
  | 'led-bobber'
  | 'turbo-bot-chip'
  | 'heavy-duty-basket'
  | 'tackle-apron'
  | 'salvage-magnet'
  | 'insulated-cooler'
  | 'sonar-scanner';

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  maxTier: number;
  costPerTier: { coins: number; materials: Partial<Record<MaterialId, number>> }[];
}

export const UPGRADE_CATALOG: UpgradeDefinition[] = [
  {
    id: 'carbon-rod',
    name: 'Carbon Rod',
    description: '+150ms bite reaction window per tier.',
    maxTier: 3,
    costPerTier: [
      { coins: 80, materials: { wood: 2 } },
      { coins: 220, materials: { wood: 4, metal: 2 } },
      { coins: 500, materials: { wood: 6, metal: 4 } },
    ],
  },
  {
    id: 'led-bobber',
    name: 'LED Bobber',
    description: '-20% bite wait time.',
    maxTier: 1,
    costPerTier: [{ coins: 150, materials: { glass: 3, metal: 1 } }],
  },
  {
    id: 'turbo-bot-chip',
    name: 'Turbo Bot Chip',
    description: '-30% fishbot cycle time.',
    maxTier: 1,
    costPerTier: [{ coins: 350, materials: { metal: 5, fiber: 2 } }],
  },
  {
    id: 'heavy-duty-basket',
    name: 'Heavy Duty Basket',
    description: '+6 basket slots.',
    maxTier: 1,
    costPerTier: [{ coins: 120, materials: { fabric: 3, fiber: 2 } }],
  },
  {
    id: 'tackle-apron',
    name: 'Tackle Apron',
    description: '+6 more basket slots.',
    maxTier: 1,
    costPerTier: [{ coins: 260, materials: { fabric: 4, rubber: 2 } }],
  },
  {
    id: 'salvage-magnet',
    name: 'Salvage Magnet',
    description: '30% chance to double recycled materials.',
    maxTier: 1,
    costPerTier: [{ coins: 200, materials: { metal: 3, rubber: 2 } }],
  },
  {
    id: 'insulated-cooler',
    name: 'Insulated Cooler',
    description: '+15% permanent market sale value.',
    maxTier: 1,
    costPerTier: [{ coins: 400, materials: { fabric: 3, glass: 2 } }],
  },
  {
    id: 'sonar-scanner',
    name: 'Sonar Scanner',
    description: '+50% chance weight on Rare/Epic/Legendary catches.',
    maxTier: 1,
    costPerTier: [{ coins: 700, materials: { metal: 6, glass: 4 } }],
  },
];

export const BASKET_BASE_CAPACITY = 8;
export const FISHBOT_HOPPER_CAPACITY = 10;

export interface FishbotDefinition {
  id: 'fishbot-mk1' | 'fishbot-mk2';
  name: string;
  cost: number;
  baseIntervalSeconds: number;
  rarityBias: Rarity[];
}

export const FISHBOT_CATALOG: FishbotDefinition[] = [
  { id: 'fishbot-mk1', name: 'Fishbot Mk I', cost: 750, baseIntervalSeconds: 45, rarityBias: ['trash', 'common', 'common', 'uncommon'] },
  { id: 'fishbot-mk2', name: 'Fishbot Mk II', cost: 2500, baseIntervalSeconds: 30, rarityBias: ['common', 'uncommon', 'uncommon', 'rare'] },
];

export function xpToNextLevel(level: number): number {
  return Math.round(40 * Math.pow(level, 1.4));
}

export function themeForLevel(level: number): ThemeId {
  if (level >= 20) return 'cosmic-lake';
  if (level >= 10) return 'ocean-trench';
  return 'forest-pond';
}

export interface RarityWeights extends Record<Rarity, number> {}

export function computeRarityWeights(effectiveSkill: number, sonarScanner: boolean): RarityWeights {
  const s = Math.max(0, effectiveSkill);
  let trash = Math.max(8, 35 - 0.2 * s);
  let common = Math.max(20, 40 - 0.1 * s);
  let uncommon = 15 + 0.05 * s;
  let rare = 7 + 0.12 * s;
  let epic = 2.5 + 0.08 * s;
  let legendary = 0.5 + 0.05 * s;

  if (sonarScanner) {
    rare *= 1.5;
    epic *= 1.5;
    legendary *= 1.5;
  }

  const total = trash + common + uncommon + rare + epic + legendary;
  return {
    trash: (trash / total) * 100,
    common: (common / total) * 100,
    uncommon: (uncommon / total) * 100,
    rare: (rare / total) * 100,
    epic: (epic / total) * 100,
    legendary: (legendary / total) * 100,
  };
}

export function rollRarity(weights: RarityWeights, roll = Math.random()): Rarity {
  let cumulative = 0;
  for (const rarity of RARITY_ORDER) {
    cumulative += weights[rarity];
    if (roll * 100 <= cumulative) return rarity;
  }
  return 'trash';
}
