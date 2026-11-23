export interface StoryChapter {
  id: string;
  chapterNumber: number;
  title: string;
  subtitle: string;
  lore: string;
  objectives: {
    id: string;
    description: string;
    target: number;
    type: 'catch_count' | 'salvage_count' | 'reach_level' | 'catch_rarity' | 'craft_upgrade' | 'weather_catch' | 'perfect_casts' | 'whale_jump';
    param?: string; // e.g. rarity or weather
  }[];
  rewards: {
    coins: number;
    xp: number;
    candyBars?: number;
    titleReward?: string;
    bait?: { id: string; count: number };
  };
  barnabyIntroDialogue: string;
  barnabyCompleteDialogue: string;
}

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 'ch1_murmuring_pond',
    chapterNumber: 1,
    title: 'The Murmuring Pond',
    subtitle: 'Where every angler begins',
    lore: "Old Barnaby leans on his wooden cane, squinting at the ripples. 'There was a time when the water sang like church bells. If you've got the patience, rookie, the pond might just speak to you too.'",
    objectives: [
      { id: 'ch1_catch_5', description: 'Catch 5 fish of any kind', target: 5, type: 'catch_count' },
      { id: 'ch1_salvage_3', description: 'Salvage 3 pieces of trash at the bench', target: 3, type: 'salvage_count' },
      { id: 'ch1_reach_lv2', description: 'Reach Angler Level 2', target: 2, type: 'reach_level' },
    ],
    rewards: {
      coins: 100,
      xp: 60,
      titleReward: 'Pond Tender',
      bait: { id: 'marshmallows', count: 10 },
    },
    barnabyIntroDialogue: "Keep your eyes on the bobber, lad. Even the smallest minnow has a lesson to teach.",
    barnabyCompleteDialogue: "Not bad at all! You've got the touch. The pond knows your name now.",
  },
  {
    id: 'ch2_trench_echoes',
    chapterNumber: 2,
    title: 'Echoes of the Deep Trench',
    subtitle: 'Unveiling the submerged secrets',
    lore: "Beneath the calm shallows lies a sheer drop into the abyss. Barnaby says strange creatures with bioluminescent lanterns swim in the cold currents, waiting for an angler brave enough to cast into the dark.",
    objectives: [
      { id: 'ch2_reach_lv10', description: 'Reach Angler Level 10 (Unlocks Ocean Trench)', target: 10, type: 'reach_level' },
      { id: 'ch2_catch_uncommon', description: 'Catch 3 Uncommon or Rare fish', target: 3, type: 'catch_rarity', param: 'uncommon' },
      { id: 'ch2_craft_rod', description: 'Craft Carbon Rod or Braided Line', target: 1, type: 'craft_upgrade', param: 'carbon-rod' },
    ],
    rewards: {
      coins: 350,
      xp: 200,
      candyBars: 5,
      titleReward: 'Trench Navigator',
      bait: { id: 'nightcrawlers', count: 10 },
    },
    barnabyIntroDialogue: "The trench is dark and unforgiving. Better make sure your line is sturdy before you drop a hook down there.",
    barnabyCompleteDialogue: "Ha! Look at that specimen! Most folks would've snapped their line in two seconds flat.",
  },
  {
    id: 'ch3_gathering_storm',
    chapterNumber: 3,
    title: 'The Whispering Storm',
    subtitle: 'Braving rain, fog, and tempest',
    lore: "When the sky turns slate-grey and raindrops dimple the water, the shyest giants stir from the muddy bed. A true master of the rod doesn't run from the downpour — they lean into the spray.",
    objectives: [
      { id: 'ch3_weather_catch', description: 'Catch 3 fish during Rain, Fog, or Rainbow', target: 3, type: 'weather_catch' },
      { id: 'ch3_salvage_10', description: 'Salvage 10 pieces of debris from the water', target: 10, type: 'salvage_count' },
      { id: 'ch3_insulated_cooler', description: 'Craft the Insulated Cooler upgrade', target: 1, type: 'craft_upgrade', param: 'insulated-cooler' },
    ],
    rewards: {
      coins: 650,
      xp: 350,
      candyBars: 10,
      titleReward: 'Storm Chaser',
      bait: { id: 'neon-super-lure', count: 5 },
    },
    barnabyIntroDialogue: "Hear that rumble? Storm's rolling in. That's when the big ones wake up hungry.",
    barnabyCompleteDialogue: "Soaked to the bone, eh? But look at your bucket! Worth every drop of rain.",
  },
  {
    id: 'ch4_celestial_canopy',
    chapterNumber: 4,
    title: 'The Celestial Canopy',
    subtitle: 'Where the stars reflect like jewels',
    lore: "At Level 20, the Cosmic Lake awakens. The boundary between water and cosmos blurs into shimmering starlight. Void rays and chrono carp swim amongst the floating constellations.",
    objectives: [
      { id: 'ch4_reach_lv20', description: 'Reach Angler Level 20 (Unlocks Cosmic Lake)', target: 20, type: 'reach_level' },
      { id: 'ch4_epic_catch', description: 'Catch 2 Epic or Legendary fish', target: 2, type: 'catch_rarity', param: 'epic' },
      { id: 'ch4_perfect_casts', description: 'Perform 5 Perfect Casts', target: 5, type: 'perfect_casts' },
    ],
    rewards: {
      coins: 1200,
      xp: 600,
      candyBars: 20,
      titleReward: 'Cosmic Stargazer',
    },
    barnabyIntroDialogue: "I don't know what kind of magic turns a pond into a galaxy, but I know a hungry fish when I see one.",
    barnabyCompleteDialogue: "You've reeled in a piece of the night sky itself. I tip my hat to you, captain.",
  },
  {
    id: 'ch5_leviathan_call',
    chapterNumber: 5,
    title: "Barnaby's Legacy & The Leviathan",
    subtitle: 'The ultimate myth of the open water',
    lore: "Sailors whisper of the Great Whale that breaches when the waters are honored. Only those who have mastered every trick, held every line, and earned the respect of the dock can summon the beast.",
    objectives: [
      { id: 'ch5_whale_jump', description: 'Witness or summon the Great Whale Breach', target: 1, type: 'whale_jump' },
      { id: 'ch5_legendary_catch', description: 'Land any Legendary Tier Catch', target: 1, type: 'catch_rarity', param: 'legendary' },
      { id: 'ch5_reach_lv30', description: 'Reach Angler Level 30', target: 30, type: 'reach_level' },
    ],
    rewards: {
      coins: 3000,
      xp: 1500,
      candyBars: 50,
      titleReward: 'Master of the Deep',
    },
    barnabyIntroDialogue: "It's out there. The creature that started all the dock legends. Let's see if you've got what it takes.",
    barnabyCompleteDialogue: "By the tides... you did it! You're not just an angler anymore — you're a living legend of Fish and Chat!",
  },
];

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  type: 'catch_total' | 'catch_weight' | 'perfect_casts' | 'salvage' | 'weather_catch' | 'sell_value';
  reward: { coins: number; xp: number; candyBars?: number };
}

export const DAILY_QUEST_TEMPLATES = [
  { id: 'dq_catch_10', title: 'Daily Haul', description: 'Catch 10 fish', target: 10, type: 'catch_total', reward: { coins: 80, xp: 50 } },
  { id: 'dq_weight_15', title: 'Heavy Scales', description: 'Catch a total of 15 kg of fish', target: 15, type: 'catch_weight', reward: { coins: 120, xp: 75 } },
  { id: 'dq_perfect_3', title: 'Bullseye Casts', description: 'Execute 3 Perfect Casts', target: 3, type: 'perfect_casts', reward: { coins: 100, xp: 60 } },
  { id: 'dq_salvage_5', title: 'Clean Waters', description: 'Recycle 5 debris items at the bench', target: 5, type: 'salvage', reward: { coins: 90, xp: 50 } },
  { id: 'dq_weather_2', title: 'Braving Elements', description: 'Catch 2 fish during Rain, Fog, or Rainbow', target: 2, type: 'weather_catch', reward: { coins: 140, xp: 80, candyBars: 1 } },
  { id: 'dq_sell_200', title: 'Market Day', description: 'Sell 200 coins worth of fish to Barnaby', target: 200, type: 'sell_value', reward: { coins: 100, xp: 60 } },
] as const;

export interface Milestone {
  id: string;
  name: string;
  category: 'catches' | 'weight' | 'species' | 'salvage';
  tierName: string;
  target: number;
  description: string;
  reward: { coins: number; xp: number; candyBars?: number };
}

export const MILESTONES: Milestone[] = [
  { id: 'm_catches_25', name: 'Apprentice Fisherman', category: 'catches', tierName: 'Bronze', target: 25, description: 'Catch 25 fish', reward: { coins: 100, xp: 75 } },
  { id: 'm_catches_100', name: 'Seasoned Angler', category: 'catches', tierName: 'Silver', target: 100, description: 'Catch 100 fish', reward: { coins: 300, xp: 200, candyBars: 5 } },
  { id: 'm_catches_500', name: 'Master Fisherman', category: 'catches', tierName: 'Gold', target: 500, description: 'Catch 500 fish', reward: { coins: 1000, xp: 750, candyBars: 20 } },
  { id: 'm_weight_50', name: 'Scale Buster', category: 'weight', tierName: 'Bronze', target: 50, description: 'Land 50 kg of total fish weight', reward: { coins: 150, xp: 100 } },
  { id: 'm_weight_250', name: 'Whale Weigh-In', category: 'weight', tierName: 'Silver', target: 250, description: 'Land 250 kg of total fish weight', reward: { coins: 500, xp: 350, candyBars: 10 } },
  { id: 'm_weight_1000', name: 'Leviathan Scaler', category: 'weight', tierName: 'Gold', target: 1000, description: 'Land 1,000 kg of total fish weight', reward: { coins: 1800, xp: 1200, candyBars: 35 } },
  { id: 'm_species_10', name: 'Pond Zoologist', category: 'species', tierName: 'Bronze', target: 10, description: 'Discover 10 different species', reward: { coins: 200, xp: 150 } },
  { id: 'm_species_20', name: 'Abyssal Scholar', category: 'species', tierName: 'Silver', target: 20, description: 'Discover 20 different species', reward: { coins: 600, xp: 450, candyBars: 15 } },
  { id: 'm_species_26', name: 'Master Taxonomist', category: 'species', tierName: 'Gold', target: 26, description: 'Complete the entire Scrapbook species catalog', reward: { coins: 2000, xp: 1500, candyBars: 50 } },
  { id: 'm_salvage_20', name: 'Shoreline Sweeper', category: 'salvage', tierName: 'Bronze', target: 20, description: 'Salvage 20 pieces of junk', reward: { coins: 100, xp: 80 } },
  { id: 'm_salvage_100', name: 'Reef Restorer', category: 'salvage', tierName: 'Silver', target: 100, description: 'Salvage 100 pieces of junk', reward: { coins: 350, xp: 250, candyBars: 8 } },
];
