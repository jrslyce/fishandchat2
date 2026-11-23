export interface CurioRelic {
  id: string;
  name: string;
  rarity: 'uncommon' | 'rare' | 'epic' | 'legendary';
  lore: string;
  perkDescription: string;
  iconEmoji: string;
}

export const CURIO_RELICS: CurioRelic[] = [
  {
    id: 'relic_brass_compass',
    name: 'Weathered Brass Compass',
    rarity: 'uncommon',
    lore: 'Forged in 1788 by a Bristol instrument maker and carried aboard the schooner Wanderer. Its magnetized needle ignores terrestrial north, instead quivering toward submerged ocean trenches and undersea rifts.',
    perkDescription: '+5% increased bite rate & guidance toward deep species',
    iconEmoji: '🧭',
  },
  {
    id: 'relic_barnaby_pipe',
    name: "Barnaby's Carved Briar Pipe",
    rarity: 'uncommon',
    lore: "Carved by Barnaby during an unforgiving autumn gale that kept him dock-bound for forty days. Still smells softly of cured Virginia cherry tobacco and dried sea spray. Barnaby claims it kept his hands steady through every monster catch.",
    perkDescription: '+150ms fight reel window & reduced line tension build-up',
    iconEmoji: '🪵',
  },
  {
    id: 'relic_galleon_doubloon',
    name: 'Sunken Galleon Doubloon',
    rarity: 'rare',
    lore: "An uncirculated 1715 Spanish gold eight-escudo coin dredged from the coral-encrusted ballast stones of the Santa Margarita. Even after centuries in the brine, it gleams with an unearthly, untarnished fire.",
    perkDescription: '+15% bonus coin value when selling catches to Barnaby',
    iconEmoji: '🪙',
  },
  {
    id: 'relic_lighthouse_prism',
    name: "Keeper Thomas's Beacon Prism",
    rarity: 'rare',
    lore: 'A hand-ground crystal wedge recovered from the storm-shattered lantern room of the Murmuring Bay lighthouse. It catches the dimmest ray of dawn light and throws prismatic beams far out across the choppy water.',
    perkDescription: '+20% rare bite chance during Fog, Rain, or Tempest',
    iconEmoji: '💎',
  },
  {
    id: 'relic_clockwork_heart',
    name: 'Sunken Clockwork Heart',
    rarity: 'epic',
    lore: 'An astonishing mechanical marvel recovered from the engine room remains of the S.S. Marigold. Crafted from brass gears and sapphire jewel bearings, its escapement wheel continues ticking silently without winding, pulsing in rhythm with the tides.',
    perkDescription: 'Fishbots cycle 15% faster and yield +1 bonus material on salvage',
    iconEmoji: '⚙️',
  },
  {
    id: 'relic_abyssal_pearl',
    name: 'Luminescent Abyssal Pearl',
    rarity: 'epic',
    lore: 'A flawless, pearlescent sphere plucked from a giant abyssal bivalve living five hundred fathoms deep. It emits a perpetual cold ultraviolet glow that draws inquisitive deep-water creatures directly to your hook.',
    perkDescription: '+10% chance for double catches when fishing',
    iconEmoji: '🔮',
  },
  {
    id: 'relic_leviathan_tooth',
    name: 'Petrified Leviathan Tooth',
    rarity: 'legendary',
    lore: 'A serrated, fossilized fang shed by the Great Ancient Leviathan during an epochal breach before recorded history. Forgotten coastal tribes carved protection runes into its root to ward off abyssal squalls.',
    perkDescription: '+25% skill power and line durability against legendary bosses',
    iconEmoji: '🦷',
  },
  {
    id: 'relic_starfall_shard',
    name: 'Celestial Starfall Shard',
    rarity: 'legendary',
    lore: 'A crystalline meteorite fragment pulled from the bed of the Cosmic Lake after the 1938 Perseid impact. It defies gravity slightly when held in the hand, casting dancing constellation reflections across the surface of the pond.',
    perkDescription: '+100% XP bonus on Perfect Casts & passive starlight aura',
    iconEmoji: '🌠',
  },
];

const RELIC_MAP = new Map<string, CurioRelic>(CURIO_RELICS.map((r) => [r.id, r]));

export function getCurioRelic(id: string): CurioRelic | undefined {
  return RELIC_MAP.get(id);
}
