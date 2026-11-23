export type CommunityGoalCategory = 'weight' | 'salvage' | 'rare_fish' | 'perfect_casts';

export interface CheerPack {
  id: string;
  name: string;
  description: string;
  costCandyBars: number;
  progressBoost: number;
}

export interface CommunityCompletionRewards {
  coins: number;
  xp: number;
  candyBars: number;
  title: string;
}

export interface CommunityGoal {
  id: string;
  name: string;
  description: string;
  category: CommunityGoalCategory;
  targetValue: number;
  currentValue: number;
  bossName: string;
  durationMinutes: number;
  cheerPacks: CheerPack[];
  completionRewards: CommunityCompletionRewards;
}

export const COMMUNITY_BOSS_RAIDS: CommunityGoal[] = [
  {
    id: 'ancient-leviathan',
    name: 'The Great Ancient Leviathan',
    description: 'Channel lands 300 kg total fish weight together to draw the primordial leviathan from the ocean trench.',
    category: 'weight',
    targetValue: 300,
    currentValue: 0,
    bossName: 'The Great Ancient Leviathan',
    durationMinutes: 45,
    cheerPacks: [
      {
        id: 'mega-chum',
        name: 'Throw Mega Chum',
        description: 'Tosses rich aromatic chum into the current (+25 kg progress)',
        costCandyBars: 20,
        progressBoost: 25,
      },
      {
        id: 'sonar-ping',
        name: 'Sonar Ping',
        description: 'Sends high-frequency acoustic echo down into the trench (+50 kg progress)',
        costCandyBars: 40,
        progressBoost: 50,
      },
    ],
    completionRewards: {
      coins: 500,
      xp: 350,
      candyBars: 10,
      title: 'Leviathan Slayer',
    },
  },
  {
    id: 'sunken-galleon',
    name: 'Sunken Pirate Galleon',
    description: 'Channel recovers 30 pieces of debris/salvage together to dislodge the haunted wreck.',
    category: 'salvage',
    targetValue: 30,
    currentValue: 0,
    bossName: 'Sunken Pirate Galleon',
    durationMinutes: 45,
    cheerPacks: [
      {
        id: 'salvage-dredge',
        name: 'Salvage Dredge Net',
        description: 'Sweeps seabed wreckage toward the surface (+3 salvage)',
        costCandyBars: 15,
        progressBoost: 3,
      },
      {
        id: 'deep-charge',
        name: 'Deep Salvage Charge',
        description: 'Blasts loose sunken timbers from the wreckage (+7 salvage)',
        costCandyBars: 35,
        progressBoost: 7,
      },
    ],
    completionRewards: {
      coins: 450,
      xp: 300,
      candyBars: 10,
      title: 'Galleon Salvager',
    },
  },
  {
    id: 'starlit-serpent',
    name: 'The Midnight Starlit Serpent',
    description: 'Channel catches 10 Rare+ fish or performs 15 Perfect Casts to awaken the celestial dragon.',
    category: 'rare_fish',
    targetValue: 10,
    currentValue: 0,
    bossName: 'The Midnight Starlit Serpent',
    durationMinutes: 45,
    cheerPacks: [
      {
        id: 'starlight-lure',
        name: 'Starlight Lure',
        description: 'Illuminates the waters with cosmic luminescence (+2 serpent summons)',
        costCandyBars: 20,
        progressBoost: 2,
      },
      {
        id: 'supernova-flare',
        name: 'Supernova Flare',
        description: 'Blazes radiant stellar aura over the fishing hole (+5 serpent summons)',
        costCandyBars: 40,
        progressBoost: 5,
      },
    ],
    completionRewards: {
      coins: 600,
      xp: 450,
      candyBars: 15,
      title: 'Serpent Tamer',
    },
  },
  {
    id: 'astral-tempest',
    name: 'The Astral Tempest Siren',
    description: 'Channel executes 15 Perfect Casts together to harmonize with the tempest siren.',
    category: 'perfect_casts',
    targetValue: 15,
    currentValue: 0,
    bossName: 'The Astral Siren',
    durationMinutes: 45,
    cheerPacks: [
      {
        id: 'focus-prism',
        name: 'Harmonic Prism',
        description: 'Focuses cosmic currents into flawless casts (+3 perfect casts)',
        costCandyBars: 20,
        progressBoost: 3,
      },
      {
        id: 'chronos-surge',
        name: 'Chronos Surge',
        description: 'Ripples spacetime for effortless precision (+7 perfect casts)',
        costCandyBars: 40,
        progressBoost: 7,
      },
    ],
    completionRewards: {
      coins: 550,
      xp: 350,
      candyBars: 10,
      title: 'Tempest Whisperer',
    },
  },
];

/**
 * Creates a fresh, deep-cloned instance of a community goal template with currentValue at 0.
 */
export function createCommunityGoal(idOrTemplate?: string | CommunityGoal): CommunityGoal {
  let template: CommunityGoal | undefined;
  if (typeof idOrTemplate === 'string') {
    template = COMMUNITY_BOSS_RAIDS.find((g) => g.id === idOrTemplate);
  } else if (idOrTemplate) {
    template = idOrTemplate;
  }
  if (!template) {
    template = COMMUNITY_BOSS_RAIDS[0];
  }

  return {
    ...template,
    cheerPacks: template.cheerPacks.map((c) => ({ ...c })),
    completionRewards: { ...template.completionRewards },
    currentValue: 0,
  };
}

/**
 * Cycles to the next community boss raid in the catalog.
 */
export function getNextGoalTemplate(currentGoalId: string): CommunityGoal {
  const currentIndex = COMMUNITY_BOSS_RAIDS.findIndex((g) => g.id === currentGoalId);
  const nextIndex = (currentIndex + 1) % COMMUNITY_BOSS_RAIDS.length;
  return createCommunityGoal(COMMUNITY_BOSS_RAIDS[nextIndex]);
}
