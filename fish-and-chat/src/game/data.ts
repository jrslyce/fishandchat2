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
  if (level < 5) {
    return Math.round(50 * Math.pow(level, 1.35));
  }
  return Math.round(60 * Math.pow(level, 1.85));
}

export interface LevelPerk {
  level: number;
  name: string;
  description: string;
  badge: string;
}

export const LEVEL_PERKS: LevelPerk[] = [
  { level: 2, name: 'Bait Mastery', description: '-10% bite wait time on all baits.', badge: '🪱' },
  { level: 5, name: 'Weather Lore', description: '+25% catch value & XP during Rain, Fog, or Rainbow.', badge: '🌦️' },
  { level: 8, name: 'Deep Vision', description: 'Underwater fish shadows emit sparkle cues hinting at rarity tier.', badge: '👁️' },
  { level: 10, name: 'Ocean Trench Biome', description: 'Access deep abyss waters and exotic trench species.', badge: '🌊' },
  { level: 15, name: 'Double Hook Technique', description: '5% chance to hook two catches on a single cast.', badge: '🪝' },
  { level: 20, name: 'Cosmic Lake Biome', description: 'Access stellar waters and void leviathan fauna.', badge: '✨' },
  { level: 25, name: 'Master Intuition', description: '+30% wider perfect cast timing sweet spot.', badge: '🎯' },
  { level: 30, name: 'Leviathan Whisperer', description: 'Greatly increases the chance of Epic & Legendary fish shadows.', badge: '🐋' },
  { level: 40, name: 'Sea Aura', description: 'Luminescent casting line and glowing ripples.', badge: '🌟' },
  { level: 50, name: 'Living Legend', description: '+25% permanent catch sale value and prestige eligibility.', badge: '👑' },
];

export function getLevelPerk(level: number): LevelPerk | undefined {
  return LEVEL_PERKS.find((p) => p.level === level);
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

/**
 * Calculates dynamic market/reward value for a caught fish based on its weight.
 * Scales from 70% of baseValue for minimum-weight runts up to 160% of baseValue for monster trophy catches.
 */
export function calculateFishValue(
  species: CatchDefinition,
  weightKg: number,
  saleMultiplier: number = 1.0
): number {
  const [min, max] = species.weightRangeKg;
  const norm = max > min ? Math.max(0, Math.min(1, (weightKg - min) / (max - min))) : 0.5;
  const weightFactor = 0.7 + 0.9 * norm;
  return Math.max(1, Math.round(species.baseValue * weightFactor * saleMultiplier));
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
  { id: 'rainbow-totem', name: 'Rainbow Totem', description: 'Shows a rainbow for 5 minutes on your pond. Your catches earn 2x XP and rare, epic, and legendary bite weights rise by 50%.', costCandyBars: 60 },
  { id: 'mega-chum-bucket', name: 'Mega Chum Bucket', description: 'Halves your bite wait times for 10 minutes.', costCandyBars: 40 },
  { id: 'whale-call-horn', name: 'Whale Call Horn', description: 'Summons a whale breach on your pond and grants your fisher 100 coins.', costCandyBars: 50 },
  { id: 'bottomless-tackle-box', name: 'Bottomless Tackle Box', description: 'Permanent animated golden tackle box beside your fisher. Holds up to 999,999 fish in your basket, gives every owned fishbot 5x hopper space before it needs emptying, and adds 40 percentage points to your chance of saving paid bait on each cast (40% normally; 65% when Bait Saver also applies).', costCandyBars: 200 },
  { id: 'master-salvage-magnet', name: 'Master Salvage Magnet', description: 'Permanent 50% chance to double all recycled materials at the crafting bench.', costCandyBars: 50 },
  { id: 'golden-rod-skin', name: 'Golden Rod Skin', description: 'A shimmering cosmetic finish for your rod.', costCandyBars: 40 },
  { id: 'starlight-fishbot-skin', name: 'Starlight Fishbot Skin', description: 'Cosmic paint and orbiting stars on your dock-side fishbot when you own a fishbot.', costCandyBars: 60 },
  { id: 'party-hat', name: 'Party Hat', description: 'A cosmetic hat for your angler.', costCandyBars: 20 },
  { id: 'captain-hat', name: "Captain's Tricorn Hat", description: 'A dashing navy tricorn hat with gold lace.', costCandyBars: 40 },
  { id: 'royal-crown', name: 'Royal Gilded Crown', description: 'Gleaming golden crown set with radiant emeralds and rubies.', costCandyBars: 50 },
  { id: 'royal-cloak', name: 'Royal Gilded Robe', description: 'Regal crimson velvet bordered by ermine trim and embroidered gold tassels.', costCandyBars: 50 },
  { id: 'golden-boots', name: 'Golden High-Roller Boots', description: 'Polished solid gold boots that clink with every step.', costCandyBars: 35 },
  { id: 'cosmic-wizard-hat', name: 'Cosmic Wizard Hat', description: 'Pointed midnight violet hat radiating celestial starlight with a golden moon crest.', costCandyBars: 45 },
  { id: 'nebula-robe', name: 'Nebula Robe', description: 'Shimmering violet robe woven with celestial constellations and stardust.', costCandyBars: 55 },
  { id: 'abyssal-trench-coat', name: 'Abyssal Trench Coat', description: 'Dark high-tech trench coat lined with bio-reactive neon cyan conduits.', costCandyBars: 50 },
  { id: 'disco-crown', name: 'Disco Crown', description: 'Mirrored party crown with hot pink light panels.', costCandyBars: 35 },
  { id: 'aurora-helmet', name: 'Aurora Helmet', description: 'Iridescent helmet with a glowing polar visor.', costCandyBars: 45 },
  { id: 'neon-arcade-jacket', name: 'Neon Arcade Jacket', description: 'Electric purple jacket with radiant arcade stripes.', costCandyBars: 45 },
  { id: 'dragon-scale-coat', name: 'Dragon Scale Coat', description: 'Emerald scale coat with gold finned shoulders.', costCandyBars: 55 },
  { id: 'hologram-trousers', name: 'Hologram Trousers', description: 'Color-shifting trousers with luminous side panels.', costCandyBars: 40 },
  { id: 'royal-sailor-pants', name: 'Royal Sailor Pants', description: 'Tailored blue-and-gold trousers for a fleet admiral.', costCandyBars: 35 },
  { id: 'comet-skates', name: 'Comet Skates', description: 'Midnight skates with star-bright runners.', costCandyBars: 45 },
  { id: 'jewel-slippers', name: 'Jewel Slippers', description: 'Ruby slippers with polished gold trim.', costCandyBars: 30 },
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
  isNew?: boolean;
  /** Per-body-part overlay texture URLs; only the parts relevant to `slot` need entries. */
  textures: Partial<Record<ClothingPart, string>>;
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

function newClosetItem(id: string, slot: ClothingSlot, name: string, flavor: string, unlock: ClothingDefinition['unlock']): ClothingDefinition {
  const path = (part: string) => `./images/clothing/${id}-${part}.png`;
  const textures = slot === 'hat' ? { head: path('head') }
    : slot === 'jacket' ? { body: path('body'), rightArm: path('arm'), leftArm: path('arm') }
      : { rightLeg: path('leg'), leftLeg: path('leg') };
  return { id, slot, name, flavor, textures, unlock, isNew: true };
}

const CLOSET_EXPANSION: ClothingDefinition[] = [
  newClosetItem('sunflower-bucket-hat', 'hat', 'Sunflower Bucket Hat', 'Golden canvas with a bright little flower at the crown.', { type: 'craft', coins: 95, materials: { fabric: 2 } }),
  newClosetItem('raincloud-cap', 'hat', 'Raincloud Cap', 'Slate-blue cap with a tiny cloud over the brow.', { type: 'craft', coins: 90, materials: { fabric: 1, rubber: 1 } }),
  newClosetItem('koi-headband', 'hat', 'Koi Headband', 'A red-and-white koi circles a lucky woven band.', { type: 'craft', coins: 85, materials: { fabric: 2 } }),
  newClosetItem('disco-crown', 'hat', 'Disco Crown', 'Mirrored panels catch every flash at the pond.', { type: 'premium', premiumId: 'disco-crown' }),
  newClosetItem('aurora-helmet', 'hat', 'Aurora Helmet', 'A luminous visor borrows its colors from the northern sky.', { type: 'premium', premiumId: 'aurora-helmet' }),
  newClosetItem('mint-windbreaker', 'jacket', 'Mint Windbreaker', 'Lightweight mint shell with crisp white trim.', { type: 'craft', coins: 115, materials: { fabric: 2, rubber: 1 } }),
  newClosetItem('coral-fishing-vest', 'jacket', 'Coral Fishing Vest', 'Bright coral pockets keep the good lures close.', { type: 'craft', coins: 120, materials: { fabric: 2, metal: 1 } }),
  newClosetItem('tidebreaker-raincoat', 'jacket', 'Tidebreaker Raincoat', 'Deep-sea blue rainwear with a wave-cut hem.', { type: 'craft', coins: 145, materials: { fabric: 2, rubber: 2 } }),
  newClosetItem('neon-arcade-jacket', 'jacket', 'Neon Arcade Jacket', 'A bright jacket for a fisher who likes an entrance.', { type: 'premium', premiumId: 'neon-arcade-jacket' }),
  newClosetItem('dragon-scale-coat', 'jacket', 'Dragon Scale Coat', 'Emerald scales and gold fins command the dock.', { type: 'premium', premiumId: 'dragon-scale-coat' }),
  newClosetItem('patched-denim', 'pants', 'Patched Denim', 'Favorite jeans repaired after one too many dock mishaps.', { type: 'craft', coins: 95, materials: { fabric: 2 } }),
  newClosetItem('tidepool-shorts', 'pants', 'Tidepool Shorts', 'Shorts patterned with little waves and sea stars.', { type: 'craft', coins: 80, materials: { fabric: 1 } }),
  newClosetItem('moss-overalls', 'pants', 'Moss Overalls', 'Practical green overalls with big pocket flaps.', { type: 'craft', coins: 120, materials: { fabric: 3, metal: 1 } }),
  newClosetItem('hologram-trousers', 'pants', 'Hologram Trousers', 'Shifting light runs down every seam.', { type: 'premium', premiumId: 'hologram-trousers' }),
  newClosetItem('royal-sailor-pants', 'pants', 'Royal Sailor Pants', 'A tailored admiral stripe and polished buttons.', { type: 'premium', premiumId: 'royal-sailor-pants' }),
  newClosetItem('dock-sandals', 'shoes', 'Dock Sandals', 'Easy to slip off before wading in.', { type: 'craft', coins: 65, materials: { fabric: 1, rubber: 1 } }),
  newClosetItem('coral-sneakers', 'shoes', 'Coral Sneakers', 'Cushioned pink-orange kicks with white laces.', { type: 'craft', coins: 95, materials: { fabric: 1, rubber: 2 } }),
  newClosetItem('storm-boots', 'shoes', 'Storm Boots', 'Tall stormproof boots with a bright lightning stripe.', { type: 'craft', coins: 125, materials: { rubber: 3 } }),
  newClosetItem('comet-skates', 'shoes', 'Comet Skates', 'Star-tipped runners leave a flash on the dock.', { type: 'premium', premiumId: 'comet-skates' }),
  newClosetItem('jewel-slippers', 'shoes', 'Jewel Slippers', 'Ruby-red shoes with a little golden glint.', { type: 'premium', premiumId: 'jewel-slippers' }),
];

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
    unlock: { type: 'craft', coins: 60 },
  },
  {
    id: 'cowboy-hat',
    slot: 'hat',
    name: 'Cowboy Hat',
    flavor: 'Wide-brimmed felt with a proper band — built for long days at the water.',
    textures: { head: './images/clothing/cowboy-hat-head.png' },
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
    unlock: { type: 'craft', coins: 120 },
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
  {
    id: 'captain-hat',
    slot: 'hat',
    name: "Captain's Tricorn",
    flavor: 'Dark navy felt laced with fine gold thread. Commands respect on any dock.',
    textures: { head: './images/clothing/captain-hat-head.png' },
    unlock: { type: 'premium', premiumId: 'captain-hat' },
  },
  {
    id: 'royal-crown',
    slot: 'hat',
    name: 'Royal Gilded Crown',
    flavor: 'Set with glowing rubies and emeralds. For royalty among anglers.',
    textures: { head: './images/clothing/royal-crown-head.png' },
    unlock: { type: 'premium', premiumId: 'royal-crown' },
  },
  {
    id: 'diver-mask',
    slot: 'hat',
    name: 'Deep Diver Helmet',
    flavor: 'Heavy riveted brass with a thick glass port. Sealed against deep currents.',
    textures: { head: './images/clothing/diver-mask-head.png' },
    unlock: { type: 'craft', coins: 180, materials: { metal: 3, glass: 2 } },
  },
  {
    id: 'cableknit-sweater',
    slot: 'jacket',
    name: 'Cableknit Sweater',
    flavor: 'Chunky cream wool, knit by hand to withstand biting ocean gales.',
    textures: {
      body: './images/clothing/cableknit-sweater-body.png',
      rightArm: './images/clothing/cableknit-sweater-arm.png',
      leftArm: './images/clothing/cableknit-sweater-arm.png',
    },
    unlock: { type: 'craft', coins: 110, materials: { fabric: 3 } },
  },
  {
    id: 'royal-cloak',
    slot: 'jacket',
    name: 'Royal Gilded Robe',
    flavor: 'Regal crimson velvet bordered by ermine trim and embroidered gold tassels.',
    textures: {
      body: './images/clothing/royal-cloak-body.png',
      rightArm: './images/clothing/royal-cloak-arm.png',
      leftArm: './images/clothing/royal-cloak-arm.png',
    },
    unlock: { type: 'premium', premiumId: 'royal-cloak' },
  },
  {
    id: 'yellow-waders',
    slot: 'pants',
    name: 'Yellow Sea Waders',
    flavor: 'Heavy-duty waterproof vinyl. Keeps the mud and swamp water right where it belongs.',
    textures: {
      rightLeg: './images/clothing/yellow-waders-leg.png',
      leftLeg: './images/clothing/yellow-waders-leg.png',
    },
    unlock: { type: 'craft', coins: 130, materials: { rubber: 3 } },
  },
  {
    id: 'diver-boots',
    slot: 'shoes',
    name: 'Lead Diver Boots',
    flavor: 'Weighted iron and lead soles. You will not be floating away anytime soon.',
    textures: {
      rightLeg: './images/clothing/diver-boots-leg.png',
      leftLeg: './images/clothing/diver-boots-leg.png',
    },
    unlock: { type: 'craft', coins: 120, materials: { metal: 2, rubber: 1 } },
  },
  {
    id: 'golden-boots',
    slot: 'shoes',
    name: 'Golden High-Roller Boots',
    flavor: 'Gleaming polished gold. Makes every step on the dock clink like treasure.',
    textures: {
      rightLeg: './images/clothing/golden-boots-leg.png',
      leftLeg: './images/clothing/golden-boots-leg.png',
    },
    unlock: { type: 'premium', premiumId: 'golden-boots' },
  },
  {
    id: 'cosmic-wizard-hat',
    slot: 'hat',
    name: 'Cosmic Wizard Hat',
    flavor: 'Pointed midnight indigo felt adorned with shimmering gold crescent and stellar embroidery.',
    textures: { head: './images/clothing/cosmic-wizard-hat-head.png' },
    unlock: { type: 'premium', premiumId: 'cosmic-wizard-hat' },
  },
  {
    id: 'nebula-robe',
    slot: 'jacket',
    name: 'Nebula Robe',
    flavor: 'Deep cosmic velvet swirling with glittering nebulae and ancient constellations.',
    textures: {
      body: './images/clothing/nebula-robe-body.png',
      rightArm: './images/clothing/nebula-robe-arm.png',
      leftArm: './images/clothing/nebula-robe-arm.png',
    },
    unlock: { type: 'premium', premiumId: 'nebula-robe' },
  },
  {
    id: 'stellar-boots',
    slot: 'shoes',
    name: 'Stellar Boots',
    flavor: 'Astral boots edged with pulsing cyan energy conduits, leaving faint starlight with each step.',
    textures: {
      rightLeg: './images/clothing/stellar-boots-leg.png',
      leftLeg: './images/clothing/stellar-boots-leg.png',
    },
    unlock: { type: 'craft', coins: 140, materials: { glass: 2, fiber: 2 } },
  },
  {
    id: 'pirate-bandana',
    slot: 'hat',
    name: 'Pirate Bandana',
    flavor: 'Crimson headscarf stamped with a skull motif and accented by a dangling gold earring.',
    textures: { head: './images/clothing/pirate-bandana-head.png' },
    unlock: { type: 'craft', coins: 80, materials: { fabric: 2 } },
  },
  {
    id: 'buccaneer-vest',
    slot: 'jacket',
    name: 'Buccaneer Vest',
    flavor: 'Weathered leather doublet vest over an exuberant ruffled white poet shirt with brass hardware.',
    textures: {
      body: './images/clothing/buccaneer-vest-body.png',
      rightArm: './images/clothing/buccaneer-vest-arm.png',
      leftArm: './images/clothing/buccaneer-vest-arm.png',
    },
    unlock: { type: 'craft', coins: 110, materials: { fabric: 2, metal: 1 } },
  },
  {
    id: 'striped-sailor-pants',
    slot: 'pants',
    name: 'Striped Sailor Pants',
    flavor: 'Crisp navy-and-white vertical striped breeches tailored for high-seas duty.',
    textures: {
      rightLeg: './images/clothing/striped-sailor-pants-leg.png',
      leftLeg: './images/clothing/striped-sailor-pants-leg.png',
    },
    unlock: { type: 'craft', coins: 95, materials: { fabric: 2 } },
  },
  {
    id: 'anglerfish-cowl',
    slot: 'hat',
    name: 'Anglerfish Cowl',
    flavor: 'Deep-sea cowl hood featuring an extended bioluminescent lure stalk arching over the brow.',
    textures: { head: './images/clothing/anglerfish-cowl-head.png' },
    unlock: { type: 'craft', coins: 150, materials: { metal: 2, glass: 2 } },
  },
  {
    id: 'abyssal-trench-coat',
    slot: 'jacket',
    name: 'Abyssal Trench Coat',
    flavor: 'Heavy midnight trench coat laced with neon cyan bio-luminescent conduits and fins.',
    textures: {
      body: './images/clothing/abyssal-trench-coat-body.png',
      rightArm: './images/clothing/abyssal-trench-coat-arm.png',
      leftArm: './images/clothing/abyssal-trench-coat-arm.png',
    },
    unlock: { type: 'premium', premiumId: 'abyssal-trench-coat' },
  },
  {
    id: 'bear-ear-beanie',
    slot: 'hat',
    name: 'Bear Ear Beanie',
    flavor: 'Warm waffle-knit fuzzy brown beanie crowned with two cute rounded bear ears.',
    textures: { head: './images/clothing/bear-ear-beanie-head.png' },
    unlock: { type: 'craft', coins: 85, materials: { fabric: 2 } },
  },
  {
    id: 'lumberjack-puffer',
    slot: 'jacket',
    name: 'Lumberjack Puffer',
    flavor: 'Quilted hunter-green puffer vest layered over rugged red-and-black buffalo plaid flannel sleeves.',
    textures: {
      body: './images/clothing/lumberjack-puffer-body.png',
      rightArm: './images/clothing/lumberjack-puffer-arm.png',
      leftArm: './images/clothing/lumberjack-puffer-arm.png',
    },
    unlock: { type: 'craft', coins: 125, materials: { fabric: 3, rubber: 1 } },
  },
  {
    id: 'camo-cargo-pants',
    slot: 'pants',
    name: 'Camo Cargo Pants',
    flavor: 'Woodland camouflage cargo trousers fitted with reinforced utility pockets and brass snaps.',
    textures: {
      rightLeg: './images/clothing/camo-cargo-pants-leg.png',
      leftLeg: './images/clothing/camo-cargo-pants-leg.png',
    },
    unlock: { type: 'craft', coins: 105, materials: { fabric: 2, rubber: 1 } },
  },
  ...CLOSET_EXPANSION,
];
