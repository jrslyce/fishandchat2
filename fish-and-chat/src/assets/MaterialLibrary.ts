import * as THREE from 'three';
import type { ThemeId } from '../game/data';

export interface ThemePalette {
  fog: string;
  sky: string;
  terrainTop: string;
  terrainMid: string;
  terrainLow: string;
  waterShallow: string;
  waterDeep: string;
  wood: string;
  woodDark: string;
  foliage: string;
  foliageAccent: string;
  accentGlow: string;
  lanternGlow: string;
}

export const THEME_PALETTES: Record<ThemeId, ThemePalette> = {
  'forest-pond': {
    fog: '#bfe3d8',
    sky: '#dff0d8',
    terrainTop: '#8fbf6a',
    terrainMid: '#6f9e54',
    terrainLow: '#4f7a3d',
    waterShallow: '#8fd0c8',
    waterDeep: '#2f6f8a',
    wood: '#a5713f',
    woodDark: '#6b4726',
    foliage: '#4c8a4a',
    foliageAccent: '#79b856',
    accentGlow: '#ffd27a',
    lanternGlow: '#ffb75e',
  },
  'ocean-trench': {
    fog: '#0f3550',
    sky: '#134863',
    terrainTop: '#3a6f7a',
    terrainMid: '#295462',
    terrainLow: '#173948',
    waterShallow: '#3fa9c9',
    waterDeep: '#0a3550',
    wood: '#5c6b6f',
    woodDark: '#33403f',
    foliage: '#2f8f8a',
    foliageAccent: '#57c2b8',
    accentGlow: '#7fe6ff',
    lanternGlow: '#63d7ff',
  },
  'cosmic-lake': {
    fog: '#1c1a3a',
    sky: '#241f4a',
    terrainTop: '#4a3f78',
    terrainMid: '#352c5e',
    terrainLow: '#211a3f',
    waterShallow: '#7a6fd0',
    waterDeep: '#221a55',
    wood: '#5a4a7a',
    woodDark: '#332750',
    foliage: '#6f5cc4',
    foliageAccent: '#a68ef0',
    accentGlow: '#ffe27a',
    lanternGlow: '#c9a6ff',
  },
};

/** Shared material roles, reused across the voxel kit rather than one-off colors per mesh. */
export class MaterialLibrary {
  readonly terrainTop: THREE.MeshStandardMaterial;
  readonly terrainMid: THREE.MeshStandardMaterial;
  readonly terrainLow: THREE.MeshStandardMaterial;
  readonly wood: THREE.MeshStandardMaterial;
  readonly woodDark: THREE.MeshStandardMaterial;
  readonly foliage: THREE.MeshStandardMaterial;
  readonly foliageAccent: THREE.MeshStandardMaterial;
  readonly stone: THREE.MeshStandardMaterial;
  readonly emissiveSignal: THREE.MeshStandardMaterial;
  readonly glass: THREE.MeshPhysicalMaterial;
  readonly fabric: THREE.MeshStandardMaterial;

  constructor(palette: ThemePalette) {
    this.terrainTop = new THREE.MeshStandardMaterial({ color: palette.terrainTop, roughness: 0.85 });
    this.terrainMid = new THREE.MeshStandardMaterial({ color: palette.terrainMid, roughness: 0.9 });
    this.terrainLow = new THREE.MeshStandardMaterial({ color: palette.terrainLow, roughness: 0.95 });
    this.wood = new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.75 });
    this.woodDark = new THREE.MeshStandardMaterial({ color: palette.woodDark, roughness: 0.8 });
    this.foliage = new THREE.MeshStandardMaterial({ color: palette.foliage, roughness: 0.8 });
    this.foliageAccent = new THREE.MeshStandardMaterial({ color: palette.foliageAccent, roughness: 0.7 });
    this.stone = new THREE.MeshStandardMaterial({ color: '#8a8f93', roughness: 0.9 });
    this.emissiveSignal = new THREE.MeshStandardMaterial({
      color: palette.lanternGlow,
      emissive: palette.lanternGlow,
      // 1.6 plus the bloom pass blew this out into a flat, oversaturated
      // blob that swallowed the box shape entirely.
      emissiveIntensity: 0.8,
      roughness: 0.4,
    });
    this.glass = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.55,
      roughness: 0.15,
      transmission: 0.6,
      thickness: 0.2,
    });
    this.fabric = new THREE.MeshStandardMaterial({ color: '#e8d9b8', roughness: 0.9 });
  }

  dispose(): void {
    for (const mat of [
      this.terrainTop,
      this.terrainMid,
      this.terrainLow,
      this.wood,
      this.woodDark,
      this.foliage,
      this.foliageAccent,
      this.stone,
      this.emissiveSignal,
      this.glass,
      this.fabric,
    ]) {
      mat.dispose();
    }
  }
}
