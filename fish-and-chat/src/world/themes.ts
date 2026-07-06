import type { ThemeId } from '../game/data';

export interface ThemeConfig {
  id: ThemeId;
  skyImage: string;
  ambienceKey: 'forest-pond' | 'ocean-trench' | 'cosmic-lake';
  fogNear: number;
  fogFar: number;
  dayNightCycle: boolean;
}

export const THEME_CONFIGS: Record<ThemeId, ThemeConfig> = {
  'forest-pond': {
    id: 'forest-pond',
    skyImage: '/images/sky-forest-pond.png',
    ambienceKey: 'forest-pond',
    fogNear: 10,
    fogFar: 26,
    dayNightCycle: true,
  },
  'ocean-trench': {
    id: 'ocean-trench',
    skyImage: '/images/sky-ocean-trench.png',
    ambienceKey: 'ocean-trench',
    fogNear: 8,
    fogFar: 22,
    dayNightCycle: false,
  },
  'cosmic-lake': {
    id: 'cosmic-lake',
    skyImage: '/images/sky-cosmic-lake.png',
    ambienceKey: 'cosmic-lake',
    fogNear: 9,
    fogFar: 24,
    dayNightCycle: false,
  },
};
