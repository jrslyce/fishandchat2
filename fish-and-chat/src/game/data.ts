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
  acronym: string;
  costPerTen: number;
  waitMultiplier: number;
  skillBonus: number;
  free?: boolean;
}

export const BAIT_CATALOG: BaitDefinition[] = [
  { id: 'pleb-bait', name: 'Pleb Bait', acronym: 'PB', costPerTen: 0, waitMultiplier: 1.0, skillBonus: 0, free: true },
  { id: 'marshmallows', name: 'Marshmallows', acronym: 'MM', costPerTen: 25, waitMultiplier: 0.85, skillBonus: 15 },
  { id: 'nightcrawlers', name: 'Nightcrawlers', acronym: 'NC', costPerTen: 100, waitMultiplier: 0.75, skillBonus: 25 },
  { id: 'neon-super-lure', name: 'Neon Super Lure', acronym: 'NSL', costPerTen: 500, waitMultiplier: 0.5, skillBonus: 50 },
];

export type UpgradeId =
  | 'carbon-rod'
  | 'braided-line'
  | 'trophy-lure'
  | 'led-bobber'
  | 'turbo-bot-chip'
  | 'heavy-duty-basket'
  | 'tackle-apron'
  | 'salvage-magnet'
  | 'insulated-cooler'
  | 'sonar-scanner'
  | 'magic-reeler';

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
    description: '+150ms reel window per tier, and boosts your skill against tough fish.',
    maxTier: 3,
    costPerTier: [
      { coins: 80, materials: { wood: 2 } },
      { coins: 220, materials: { wood: 4, metal: 2 } },
      { coins: 500, materials: { wood: 6, metal: 4 } },
    ],
  },
  {
    id: 'braided-line',
    name: 'Braided Line',
    description: 'Boosts your skill against tough fish, per tier.',
    maxTier: 3,
    costPerTier: [
      { coins: 90, materials: { fiber: 2 } },
      { coins: 240, materials: { fiber: 4, rubber: 2 } },
      { coins: 540, materials: { fiber: 6, rubber: 4 } },
    ],
  },
  {
    id: 'trophy-lure',
    name: 'Trophy Lure',
    description: 'Boosts your skill against tough fish, per tier.',
    maxTier: 3,
    costPerTier: [
      { coins: 100, materials: { glass: 2 } },
      { coins: 260, materials: { glass: 4, metal: 2 } },
      { coins: 560, materials: { glass: 6, metal: 4 } },
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
    description: '+6 basket slots per tier.',
    maxTier: 4,
    costPerTier: [
      { coins: 120, materials: { fabric: 3, fiber: 2 } },
      { coins: 280, materials: { fabric: 5, fiber: 3 } },
      { coins: 520, materials: { fabric: 7, fiber: 5, rubber: 2 } },
      { coins: 900, materials: { fabric: 10, fiber: 7, rubber: 4 } },
    ],
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
  {
    id: 'magic-reeler',
    name: 'Magic Reeler',
    description: 'Auto-reels every catch the instant it bites — no more escapes.',
    maxTier: 1,
    costPerTier: [{ coins: 1200, materials: { metal: 4, glass: 4, fiber: 4 } }],
  },
];

export type ArchetypeId = 'brawler' | 'patience' | 'trapper' | 'charmer' | 'tactician';

export interface ArchetypeDefinition {
  id: ArchetypeId;
  name: string;
  description: string;
}

/** One skill point is earned per fishing level-up; freely spent across these, one at a time. */
export const ARCHETYPE_CATALOG: ArchetypeDefinition[] = [
  { id: 'brawler', name: 'Brawler', description: '+2 skill per point. Raw power against every fight.' },
  { id: 'patience', name: 'Patience', description: '+250ms reel window per point. More slack before a bite needs your attention.' },
  { id: 'trapper', name: 'Trapper', description: '+2% success chance per point, on top of your skill-vs-fight odds.' },
  { id: 'charmer', name: 'Charmer', description: 'Fish you hook fight closer to their average, less likely to roll a nasty surprise.' },
  { id: 'tactician', name: 'Tactician', description: '+10% bonus per point on your combined rod/line/lure/bait skill.' },
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

/** Ramps from a small fraction at level 1 up to full weight at `unlockLevel` — ties big-fish odds to the same thresholds that unlock their themes (ocean-trench at 10, cosmic-lake at 20), instead of being purely skill-driven. */
function levelRarityScale(level: number, unlockLevel: number): number {
  return Math.min(1, 0.15 + (0.85 * level) / unlockLevel);
}

export function computeRarityWeights(effectiveSkill: number, sonarScanner: boolean, level: number): RarityWeights {
  const s = Math.max(0, effectiveSkill);
  let trash = Math.max(8, 35 - 0.2 * s);
  let common = Math.max(20, 40 - 0.1 * s);
  let uncommon = 15 + 0.05 * s;
  let rare = (7 + 0.12 * s) * levelRarityScale(level, 5);
  let epic = (2.5 + 0.08 * s) * levelRarityScale(level, 10);
  let legendary = (0.5 + 0.05 * s) * levelRarityScale(level, 20);

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

// --- Candy Bars: premium currency ------------------------------------------

/** A Twitch Bits → Candy Bar exchange tier, sold through the Muxy extension. */
export interface CandyBarPackDefinition {
  id: string;
  name: string;
  bitsCost: number;
  candyBars: number;
}

export const CANDY_BAR_PACKS: CandyBarPackDefinition[] = [
  { id: 'pack-snack', name: 'Snack Pack', bitsCost: 100, candyBars: 10 },
  { id: 'pack-value', name: 'Value Pack', bitsCost: 500, candyBars: 60 },
  { id: 'pack-party', name: 'Party Box', bitsCost: 1000, candyBars: 140 },
];

export interface PremiumItemDefinition {
  id: string;
  name: string;
  description: string;
  costCandyBars: number;
}

export const PREMIUM_CATALOG: PremiumItemDefinition[] = [
  { id: 'golden-rod-skin', name: 'Golden Rod Skin', description: 'A shimmering cosmetic finish for your rod.', costCandyBars: 40 },
  { id: 'starlight-fishbot-skin', name: 'Starlight Fishbot Skin', description: 'Cosmic paint job for any owned fishbot.', costCandyBars: 60 },
  { id: 'party-hat', name: 'Party Hat', description: 'A cosmetic hat for your angler.', costCandyBars: 20 },
  { id: 'sparkle-trail', name: 'Sparkle Cast Trail', description: 'Your line sparkles as it casts.', costCandyBars: 30 },
];

export const BOX_OF_NOT_FISH_COST_CANDY_BARS = 15;

export interface BoxContentEntry {
  trashId: string;
  quantity: number;
}

/**
 * Fixed, fully-disclosed contents — no randomization. Twitch's Bits-in-Extensions
 * guidelines (dev.twitch.tv/docs/extensions/guidelines-and-policies#6-bits-in-extensions,
 * section 6.2) prohibit exchanging Bits for "loot boxes with unknown items that are
 * determined randomly or by chance." Since candy bars are bought with Bits, every
 * candy-bar purchase — including this box — must show exactly what the player gets
 * before they buy it.
 */
export const BOX_OF_NOT_FISH_CONTENTS: BoxContentEntry[] = [
  { trashId: 'tin-can', quantity: 4 },
  { trashId: 'glass-bottle', quantity: 4 },
  { trashId: 'old-boot', quantity: 3 },
  { trashId: 'driftwood', quantity: 3 },
  { trashId: 'soggy-hat', quantity: 3 },
  { trashId: 'tangled-line', quantity: 3 },
];

export const BOX_OF_NOT_FISH_ITEM_COUNT = BOX_OF_NOT_FISH_CONTENTS.reduce((sum, e) => sum + e.quantity, 0);

export interface MaterialBundleDefinition {
  id: string;
  materialId: MaterialId;
  quantity: number;
  costCandyBars: number;
}

/** Same price across the board; rarer materials pay out in smaller quantities. */
export const MATERIAL_BUNDLE_CATALOG: MaterialBundleDefinition[] = [
  { id: 'bundle-rubber', materialId: 'rubber', quantity: 10, costCandyBars: 5 },
  { id: 'bundle-wood', materialId: 'wood', quantity: 10, costCandyBars: 5 },
  { id: 'bundle-fabric', materialId: 'fabric', quantity: 6, costCandyBars: 5 },
  { id: 'bundle-fiber', materialId: 'fiber', quantity: 6, costCandyBars: 5 },
  { id: 'bundle-metal', materialId: 'metal', quantity: 3, costCandyBars: 5 },
  { id: 'bundle-glass', materialId: 'glass', quantity: 3, costCandyBars: 5 },
];

// --- Player character: base tones & clothing --------------------------------

export interface BaseToneDefinition {
  id: string;
  name: string;
  /** CSS color used to flat-fill the base skin layer. */
  color: string;
}

export const BASE_TONE_CATALOG: BaseToneDefinition[] = [
  { id: 'sunfish-tan', name: 'Sunfish Tan', color: '#e0a860' },
  { id: 'moonlit-pale', name: 'Moonlit Pale', color: '#f2dcc4' },
  { id: 'river-otter-brown', name: 'River Otter Brown', color: '#8a5a3a' },
  { id: 'driftwood-grey', name: 'Driftwood Grey', color: '#9c9088' },
  { id: 'copper-carp', name: 'Copper Carp', color: '#b5652f' },
];

export type ClothingSlot = 'hat' | 'jacket' | 'pants' | 'shoes';

/** Which body-part overlay regions (see entities/character/skinLayout.ts) an item's `textures` map may fill. */
export type ClothingPart = 'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg';

export interface ClothingDefinition {
  id: string;
  slot: ClothingSlot;
  name: string;
  flavor: string;
  /** Per-body-part overlay texture URLs; only the parts relevant to `slot` need entries. */
  textures: Partial<Record<ClothingPart, string>>;
  /**
   * Hat-only: renders as real 3D geometry attached to the head bone instead of
   * (or in addition to) a flat texture overlay. The texture-overlay hat layer
   * is just a uniformly-scaled-up copy of the head cube (see PlayerObject.ts's
   * `head2Box`), so it can never silhouette wider than the head — a brim that
   * actually overhangs needs its own mesh. See entities/character/hatGeometry.ts.
   */
  hatGeometry?: { crown: string; band: string; brim: string };
  /**
   * How this item is unlocked. `craft` spends coins+materials directly (this
   * catalog owns that purchase). `premium` defers entirely to the existing
   * candy-bar premium system — `premiumId` must match a `PREMIUM_CATALOG`
   * entry, and ownership/purchase goes through `Economy.ownsPremiumItem`/
   * `buyPremiumItem` rather than this catalog's own owned-list, so we don't
   * fork the premium-currency economy into a second parallel system.
   */
  unlock: { type: 'craft'; coins: number; materials?: Partial<Record<MaterialId, number>> } | { type: 'premium'; premiumId: string };
}

export const CLOTHING_CATALOG: ClothingDefinition[] = [
  {
    id: 'basic-shirt',
    slot: 'jacket',
    name: 'Basic Shirt',
    flavor: 'Plain, comfortable, and already broken in.',
    textures: {
      body: './images/clothing/basic-shirt-body.png',
      rightArm: './images/clothing/basic-shirt-arm.png',
      leftArm: './images/clothing/basic-shirt-arm.png',
    },
    unlock: { type: 'craft', coins: 0 },
  },
  {
    id: 'basic-pants',
    slot: 'pants',
    name: 'Basic Pants',
    flavor: 'Sturdy enough for a long day at the pond.',
    textures: {
      rightLeg: './images/clothing/basic-pants-leg.png',
      leftLeg: './images/clothing/basic-pants-leg.png',
    },
    unlock: { type: 'craft', coins: 0 },
  },
  {
    id: 'basic-shoes',
    slot: 'shoes',
    name: 'Basic Shoes',
    flavor: 'Nothing fancy, but they get the job done.',
    textures: {
      rightLeg: './images/clothing/basic-shoes-leg.png',
      leftLeg: './images/clothing/basic-shoes-leg.png',
    },
    unlock: { type: 'craft', coins: 0 },
  },
  {
    id: 'red-beanie',
    slot: 'hat',
    name: 'Red Beanie',
    flavor: 'Keeps the ears warm on foggy mornings.',
    textures: { head: './images/clothing/red-beanie-head.png' },
    unlock: { type: 'craft', coins: 40, materials: { fabric: 1 } },
  },
  {
    id: 'straw-hat',
    slot: 'hat',
    name: 'Straw Hat',
    flavor: 'Wide-brimmed and woven from old cattails.',
    textures: { head: './images/clothing/straw-hat-head.png' },
    unlock: { type: 'craft', coins: 60, materials: { fiber: 2 } },
  },
  {
    id: 'cowboy-hat',
    slot: 'hat',
    name: 'Cowboy Hat',
    flavor: 'Wide-brimmed felt with a proper band — built for long days at the water.',
    textures: {},
    hatGeometry: { crown: '#a37547', band: '#4a3020', brim: '#7a5636' },
    unlock: { type: 'craft', coins: 70, materials: { fabric: 2 } },
  },
  {
    // Not a new catalog item — this equips the SaveState.ownedPremiumItemIds
    // entry already sold in the candy shop, so it reuses that purchase flow
    // rather than duplicating "party hat" as two unrelated unlockables.
    id: 'party-hat',
    slot: 'hat',
    name: 'Party Hat',
    flavor: 'A cosmetic hat for your angler.',
    textures: { head: './images/clothing/party-hat-head.png' },
    unlock: { type: 'premium', premiumId: 'party-hat' },
  },
  {
    id: 'flannel-jacket',
    slot: 'jacket',
    name: 'Flannel Jacket',
    flavor: 'Classic plaid, smells faintly of campfire.',
    textures: {
      body: './images/clothing/flannel-jacket-body.png',
      rightArm: './images/clothing/flannel-jacket-arm.png',
      leftArm: './images/clothing/flannel-jacket-arm.png',
    },
    unlock: { type: 'craft', coins: 90, materials: { fabric: 2 } },
  },
  {
    id: 'rain-slicker',
    slot: 'jacket',
    name: 'Rain Slicker',
    flavor: 'Bright yellow, in case the fish need a warning.',
    textures: {
      body: './images/clothing/rain-slicker-body.png',
      rightArm: './images/clothing/rain-slicker-arm.png',
      leftArm: './images/clothing/rain-slicker-arm.png',
    },
    unlock: { type: 'craft', coins: 120, materials: { rubber: 2 } },
  },
  {
    id: 'overalls',
    slot: 'pants',
    name: 'Overalls',
    flavor: 'One big pocket for snacks and bobbers alike.',
    textures: {
      rightLeg: './images/clothing/overalls-leg.png',
      leftLeg: './images/clothing/overalls-leg.png',
    },
    unlock: { type: 'craft', coins: 100, materials: { fabric: 2, metal: 1 } },
  },
  {
    id: 'cargo-pants',
    slot: 'pants',
    name: 'Cargo Pants',
    flavor: 'Every pocket holds a slightly different lure.',
    textures: {
      rightLeg: './images/clothing/cargo-pants-leg.png',
      leftLeg: './images/clothing/cargo-pants-leg.png',
    },
    unlock: { type: 'craft', coins: 80, materials: { fabric: 2 } },
  },
  {
    id: 'rubber-boots',
    slot: 'shoes',
    name: 'Rubber Boots',
    flavor: 'Waterproof, mostly.',
    textures: {
      rightLeg: './images/clothing/rubber-boots-leg.png',
      leftLeg: './images/clothing/rubber-boots-leg.png',
    },
    unlock: { type: 'craft', coins: 70, materials: { rubber: 2 } },
  },
  {
    id: 'sneakers',
    slot: 'shoes',
    name: 'Sneakers',
    flavor: 'Not really made for standing in mud, but here we are.',
    textures: {
      rightLeg: './images/clothing/sneakers-leg.png',
      leftLeg: './images/clothing/sneakers-leg.png',
    },
    unlock: { type: 'craft', coins: 65, materials: { fabric: 1, rubber: 1 } },
  },
];
