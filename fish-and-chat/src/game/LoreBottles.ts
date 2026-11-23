export interface LoreBottle {
  id: string;
  title: string;
  sender: string;
  date: string;
  preview: string;
  content: string;
  discoveryClue: string;
  reward: {
    coins: number;
    xp: number;
    candyBars?: number;
  };
}

export const LORE_BOTTLES: LoreBottle[] = [
  {
    id: 'bottle_murmuring_waters',
    title: 'Whispers in the Reeds',
    sender: 'Old Barnaby',
    date: 'May 4th, 1968',
    preview: 'If you sit quiet enough by the old willow, the ripples tell you everything...',
    content: `To whoever pulled this cork—

If you're reading this, you've got softer hands and keener ears than the city folks who rush through here. They think fishing is about wrestling hooks and dragging meat out of the muck. It ain't. It never was.

When the pond is glass and the morning mist rises off the lily pads, you can hear a faint humming under the current. My grandfather called it the Murmur. He swore the pond sits right above a subterranean river that flows all the way from the mountaintop glaciers down to the abyssal shelf. Every drop has traveled through ancient stone, carrying stories from centuries before we ever laid timber for this dock.

Treat the waters with respect, rookie. Don't crowd the fish, keep your line clean, and never turn your back when the water begins to churn. There are things sleeping down there that were old when the first star fell.`,
    discoveryClue: 'Hooked from the quiet reeds during early casts.',
    reward: { coins: 150, xp: 80 },
  },
  {
    id: 'bottle_barnabys_youth',
    title: 'A Boy with a Cane Pole',
    sender: 'Old Barnaby',
    date: 'August 12th, 1952',
    preview: 'Before the grey settled into my beard, I spent three weeks chasing a silver shadow...',
    content: `I was only fourteen when I carved my first pine bobber with a pocketknife my uncle brought back from the coast. Everyone told me the pond was fished out, that nothing swam here except mud turtles and tin cans.

They didn't know about the Silver Fin. Every evening at sundown, just past the sunken rowboat, this giant gleam would break the surface, quick as a mirror catching lantern light. I sat on these very boards with bare feet dangling, eating cold biscuits and casting till my shoulders burned. When I finally hooked her on a handmade fly, she towed my skiff clear across the bay before snapping my braided hemp like thread.

I cried that night, but looking back, I'm glad she broke free. The water needs its legends. If you catch everything in the deep, there's nothing left to dream about while you're waiting for a bite.`,
    discoveryClue: 'Awarded by the currents as your angling experience grows (Reach Level 5).',
    reward: { coins: 250, xp: 140, candyBars: 2 },
  },
  {
    id: 'bottle_lighthouse_watch',
    title: 'The Tempest of 1904',
    sender: 'Lighthouse Keeper Thomas',
    date: 'November 23rd, 1904',
    preview: 'The gale has shattered the northern lens. The light is flickering...',
    content: `Hour 18 of the squall. The storm surged over the seawall at midnight, throwing thirty-foot waves directly into the iron lantern room. Three panes of Fresnel glass gave way with a sound like cannon fire.

Through the spray and blinding rain, I saw what caused the swell. It wasn't just wind. Out in the deep trench, something gargantuan breached against the lightning—a dark spine longer than four clipper ships laid end-to-end, trailing phosphorescent foam. The waves followed in its wake like a moving mountain.

I have fed the kerosene burner with whale oil to keep the beacon glowing, but if the brass casing fails, heaven help the steamers trying to navigate past the outer shoals. If this bottle clears the rocks, tell my brother in New Bedford that I never left my post.`,
    discoveryClue: 'Hooked while the heavens weep during steady rainfall.',
    reward: { coins: 350, xp: 200, candyBars: 3 },
  },
  {
    id: 'bottle_ss_marigold',
    title: 'The Last Log of the S.S. Marigold',
    sender: 'Captain Evelyn Vance',
    date: 'October 14th, 1894',
    preview: 'We struck no reef. The water beneath our keel simply vanished into vapor...',
    content: `Logbook fragment, steamship S.S. Marigold. We departed Bristol carrying four hundred tons of pig iron, fine porcelain, and sixty-two passengers bound for the colonies.

At latitude 42, an unnatural lilac fog enveloped our vessel. The compass needles spun madly on their pivots. The chief engineer reported that our steam boilers cooled to ice despite full fire in the hearth. Then the seabed opened. Not with a crash, but with a low, resonant chord that vibrated inside our very teeth.

The ship began to tilt backward, not sinking into brine, but sliding into an illuminated rift lined with crystal spires and violet kelp. The passengers are calm; a strange lullaby seems to float from the trench. I am sealing our ship's manifest into this brass bottle and tossing it onto the outgoing tide. Do not mourn us. We did not drown; we sailed downward.`,
    discoveryClue: 'Drifts ashore when thick morning fog blankets the water.',
    reward: { coins: 400, xp: 220, candyBars: 3 },
  },
  {
    id: 'bottle_abyssal_trench',
    title: 'Descent into the Black Trench',
    sender: 'Dr. Aris Thorne',
    date: 'September 8th, 1933',
    preview: 'Depth gauge reads 600 fathoms. The iron hull is groaning under the pressure...',
    content: `Deep Submersible Log #14. The bathysphere tether holds steady, but the cold seeping through the eight-inch steel walls is bone-numbing. Outside our quartz porthole, the sunlight died long ago.

Yet down here, it is far from dark. We are surrounded by thousands of bioluminescent entities that defy modern biological classification—gelatinous ribbons pulsing in rhythmic polyrhythms, and colossal angler species whose lures burn with cold emerald fire.

More astonishing still is the architecture below. Our searchlight caught the stepped terraces of carved basalt blocks resting on the trench floor. These are not geological formations. They are plazas and avenues, worn smooth by ten thousand years of abyssal currents. Something built a metropolis down here before the glaciers melted. My oxygen scrubbers are down to twenty percent; we must ascend.`,
    discoveryClue: 'Dredged from the depths after braving the Ocean Trench (Reach Level 10).',
    reward: { coins: 500, xp: 280, candyBars: 4 },
  },
  {
    id: 'bottle_sunken_galleon',
    title: 'A Doubloon for the Ferryman',
    sender: 'Unknown Castaway',
    date: 'Midsummer Tide, 1782',
    preview: "The privateer 'Crescent Moon' broke apart on the Devil's Teeth reef at dawn...",
    content: `I am the last one alive on this spit of sand, with only sea gulls and salt sores for company. The Spanish galleon we chased for three months lies forty fathoms below, broken in half like a dry twig.

Its cargo holds were packed with silver ingots, emerald chalices from Cartagena, and heavy chests of minted doubloons. When the hull split on the reef, millions in coin showered across the sandbars like metallic rain. I grabbed three handfuls before the breakers threw me onto the rocks.

What good is gold to a man dying of thirst? I would trade every gleaming doubloon for a canteen of sweet well water and a loaf of black bread. If you find this bottle, look toward the jagged shoals where the water turns turquoise. The treasure is still there, guarded only by moray eels and the bones of thirty drowned sailors.`,
    discoveryClue: 'Tangled in the tackle of a Rare tier catch.',
    reward: { coins: 600, xp: 320, candyBars: 5 },
  },
  {
    id: 'bottle_whale_song',
    title: 'The Ancient Harmony',
    sender: 'Elder Mariner Silas',
    date: 'Full Moon, 1911',
    preview: 'When the Great White Whale breaches, the ocean heartbeat resets...',
    content: `I have followed the cetacean migrations for forty-two seasons, from the Arctic ice pack to the warm equatorial calms. None compare to the Great Whale of the Murmuring Bay.

The old whalers knew better than to ever launch an iron harpoon at her. She is not quarry; she is the guardian of the trench. When the moon is full and the tides run highest, she surfaces with a breach so mighty it sends spray over the top of the headland pine trees.

Her song is not like other baleen calls. It carries harmonic overtones that can be felt in the soles of your feet through the timber of your boat. Those who hear it clearly find their minds calmed and their fishing nets filled. She breaches not out of anger, but to remind us that we are guests upon the surface of an infinite world.`,
    discoveryClue: "Washed to the surface in the wake of the Great Whale's majestic breach.",
    reward: { coins: 750, xp: 400, candyBars: 6 },
  },
  {
    id: 'bottle_kraken_pact',
    title: 'The Abyssal Accord',
    sender: 'High Priest of the Tide',
    date: 'The Age of Oars (Ancient)',
    preview: 'Ten thousand fathoms beneath the swell dwells the Many-Armed slumberer...',
    content: `To the coastal tribes and those who cast nets upon the waters: Know the law of the deep sleeper.

When the leviathan of tentacles stirs from the oceanic rift, it hungers not for the flesh of men, but for the balance of the depths. In centuries past, our ancestors struck a covenant: for every hundred fish harvested from the bays, a tithe of silver and polished pearl must be cast back into the trench.

Break this covenant, and the black tentacles shall rise from the mirror surface, pulling sails, docks, and stone piers down into the vortex. Fear not the kraken when it breaches—revere it. For it keeps the ancient star-spawn bound beneath the crust, pinned down by coils of endless muscle and abyssal pressure.`,
    discoveryClue: 'Plucked from the churning foam after a Kraken tentacle breach.',
    reward: { coins: 850, xp: 450, candyBars: 8 },
  },
  {
    id: 'bottle_cosmic_meteor',
    title: 'Starfall on the Water',
    sender: 'Dr. Aris Thorne',
    date: 'August 19th, 1938',
    preview: 'The meteor did not disintegrate on impact; it sank glowing into the lake center...',
    content: `Observatory Expedition Note #88. At 03:14 AM, a bolide of extraordinary luminosity crossed the zenith from the Perseus constellation. The entire countryside was illuminated with a spectral violet hue.

We tracked the descent to the lake. Instead of an explosion and tidal surge, the celestial stone entered the water with a sound akin to hot glass dipping into oil. Within minutes, the lake water took on a luminous quality—luminescent filaments began spreading across the surface like liquid constellations.

The fish adapted within days. Species caught in the cosmic wake began exhibiting void-like scales, temporal phase shifts, and dorsal fins that shimmer like nebulae. We are no longer studying mere limnology. The lake has become a gateway between planetary biology and the outer cosmos.`,
    discoveryClue: 'Pulled from the celestial currents of the Cosmic Lake (Reach Level 20).',
    reward: { coins: 1000, xp: 550, candyBars: 10 },
  },
  {
    id: 'bottle_pirate_curse',
    title: 'The Cursed Chest of Captain Flint',
    sender: 'Captain Bartholomew Flint',
    date: "All Hallows' Eve, 1729",
    preview: 'Whosoever pulls my ironbound coffer from the abyss shall inherit the salt-fever...',
    content: `I bury this warning with the blood of my first mate still wet upon my cutlass.

We took the Portuguese treasure galleon 'San Cristobal' off the shoals, laden with golden crucifixes, star sapphires, and cursed Aztec plate. But the gold whispered. It set brother against brother until my crew slaughtered one another under the blood moon.

I sank the iron chest in the deepest crevasse of the outer trench, chained to an anchor of cold pig iron. Do not seek it. Whosoever touches the gold will feel their skin turn to fish scale and their breath crave brine until they wander the ocean bed forever as a drowned soul. Let the kraken coil around it; let the silt bury it till the sun grows cold.`,
    discoveryClue: 'Snagged while landing an Epic or Legendary prize from the deep.',
    reward: { coins: 1200, xp: 650, candyBars: 12 },
  },
];

const BOTTLE_MAP = new Map<string, LoreBottle>(LORE_BOTTLES.map((b) => [b.id, b]));

export function getLoreBottle(id: string): LoreBottle | undefined {
  return BOTTLE_MAP.get(id);
}

function matchesTrigger(
  bottleId: string,
  trigger: {
    type: 'catch' | 'weather' | 'whale' | 'kraken' | 'level';
    rarity?: string;
    weather?: string;
    level?: number;
  }
): boolean {
  switch (bottleId) {
    case 'bottle_murmuring_waters':
      return trigger.type === 'catch' && (!trigger.rarity || trigger.rarity === 'common' || trigger.rarity === 'uncommon');
    case 'bottle_barnabys_youth':
      return trigger.type === 'level' && (trigger.level ?? 0) >= 5;
    case 'bottle_lighthouse_watch':
      return trigger.type === 'weather' && (trigger.weather?.toLowerCase() === 'rain' || trigger.weather?.toLowerCase() === 'storm');
    case 'bottle_ss_marigold':
      return trigger.type === 'weather' && trigger.weather?.toLowerCase() === 'fog';
    case 'bottle_abyssal_trench':
      return trigger.type === 'level' && (trigger.level ?? 0) >= 10;
    case 'bottle_sunken_galleon':
      return trigger.type === 'catch' && trigger.rarity === 'rare';
    case 'bottle_whale_song':
      return trigger.type === 'whale';
    case 'bottle_kraken_pact':
      return trigger.type === 'kraken';
    case 'bottle_cosmic_meteor':
      return trigger.type === 'level' && (trigger.level ?? 0) >= 20;
    case 'bottle_pirate_curse':
      return trigger.type === 'catch' && (trigger.rarity === 'epic' || trigger.rarity === 'legendary');
    default:
      return false;
  }
}

export function checkBottleDiscovery(
  trigger: {
    type: 'catch' | 'weather' | 'whale' | 'kraken' | 'level';
    rarity?: string;
    weather?: string;
    level?: number;
  },
  ownedIds: string[]
): LoreBottle | null {
  for (const bottle of LORE_BOTTLES) {
    if (ownedIds.includes(bottle.id)) continue;
    if (matchesTrigger(bottle.id, trigger)) {
      return bottle;
    }
  }
  return null;
}
