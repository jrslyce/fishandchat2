import * as THREE from 'three';
import type { ThemeId } from '../game/data';
import {
  createBalsaWoodTexture,
  createCottonCloudTexture,
  createFlockedFoliageTexture,
} from './DioramaTextures';

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
    fog: '#d7ebe2',
    sky: '#e8f4e3',
    terrainTop: '#88bb61',
    terrainMid: '#76583d',
    terrainLow: '#4f3b2a',
    waterShallow: '#68d4c5',
    waterDeep: '#1d727c',
    wood: '#b47b47',
    woodDark: '#6c4727',
    foliage: '#4f8c44',
    foliageAccent: '#86c255',
    accentGlow: '#ffd57a',
    lanternGlow: '#ffbc57',
  },
  'ocean-trench': {
    fog: '#15425d',
    sky: '#1d5573',
    terrainTop: '#4a858d',
    terrainMid: '#375866',
    terrainLow: '#213a48',
    waterShallow: '#3fb7d1',
    waterDeep: '#0c3b59',
    wood: '#786b5c',
    woodDark: '#47443c',
    foliage: '#2f8e88',
    foliageAccent: '#62cdb8',
    accentGlow: '#7fe6ff',
    lanternGlow: '#6be6ff',
  },
  'cosmic-lake': {
    fog: '#231f47',
    sky: '#2c2556',
    terrainTop: '#584a8c',
    terrainMid: '#3d3269',
    terrainLow: '#241d46',
    waterShallow: '#7e70d6',
    waterDeep: '#241c5b',
    wood: '#645088',
    woodDark: '#3b2d5a',
    foliage: '#6d59c0',
    foliageAccent: '#ad92f2',
    accentGlow: '#ffe27a',
    lanternGlow: '#ffd978',
  },
};

/** Shared tactile Alt-A matte materials reused across the miniature diorama kit. */
export class MaterialLibrary {
  readonly terrainTop: THREE.MeshLambertMaterial;
  readonly terrainMid: THREE.MeshLambertMaterial;
  readonly terrainLow: THREE.MeshLambertMaterial;
  readonly wood: THREE.MeshLambertMaterial;
  readonly woodDark: THREE.MeshLambertMaterial;
  readonly foliage: THREE.MeshLambertMaterial;
  readonly foliageAccent: THREE.MeshLambertMaterial;
  readonly stone: THREE.MeshLambertMaterial;
  readonly emissiveSignal: THREE.MeshLambertMaterial;
  readonly glass: THREE.MeshLambertMaterial;
  readonly fabric: THREE.MeshLambertMaterial;
  readonly rope: THREE.MeshLambertMaterial;
  readonly cloud: THREE.MeshLambertMaterial;

  private readonly ownedTextures: THREE.Texture[] = [];

  constructor(palette: ThemePalette) {
    const balsaMap = createBalsaWoodTexture(palette.wood, palette.woodDark);
    const darkBalsaMap = createBalsaWoodTexture(palette.woodDark, '#2b1b10');
    const flockMap = createFlockedFoliageTexture(palette.foliage, palette.foliageAccent);
    const terrainFlockMap = createFlockedFoliageTexture(palette.terrainTop, palette.foliageAccent);
    const cloudMap = createCottonCloudTexture();

    this.ownedTextures.push(
      balsaMap,
      darkBalsaMap,
      flockMap,
      terrainFlockMap,
      cloudMap,
    );

    this.terrainTop = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      map: terrainFlockMap,
    });
    this.terrainMid = new THREE.MeshLambertMaterial({
      color: palette.terrainMid,
    });
    this.terrainLow = new THREE.MeshLambertMaterial({
      color: palette.terrainLow,
    });
    this.wood = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      map: balsaMap,
    });
    this.woodDark = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      map: darkBalsaMap,
    });
    this.foliage = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      map: flockMap,
    });
    this.foliageAccent = new THREE.MeshLambertMaterial({
      color: palette.foliageAccent,
    });
    this.stone = new THREE.MeshLambertMaterial({
      color: '#8e8a80',
    });
    this.emissiveSignal = new THREE.MeshLambertMaterial({
      color: palette.lanternGlow,
      emissive: palette.lanternGlow,
      emissiveIntensity: 0.95,
    });
    this.glass = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.45,
    });
    this.fabric = new THREE.MeshLambertMaterial({
      color: '#e8d9b8',
    });
    this.rope = new THREE.MeshLambertMaterial({
      color: '#c9a672',
    });
    this.cloud = new THREE.MeshLambertMaterial({
      color: '#ffffff',
      map: cloudMap,
      emissive: '#fff4df',
      emissiveIntensity: 0.16,
    });
  }

  dispose(): void {
    for (const tex of this.ownedTextures) {
      tex.dispose();
    }
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
      this.rope,
      this.cloud,
    ]) {
      mat.dispose();
    }
  }
}
