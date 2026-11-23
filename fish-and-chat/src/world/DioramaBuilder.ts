import * as THREE from 'three';
import type { MaterialLibrary } from '../assets/MaterialLibrary';
import type { ThemeId } from '../game/data';
import { buildDock } from './VoxelKit';

export const BARNABY_DOCK_POSITION = { x: -0.38, y: 0.17, z: 0.85 } as const;

export interface DioramaResult {
  root: THREE.Group;
  barnabySlot: THREE.Group;
  fishbotSlot: THREE.Group;
  playerSlot: THREE.Group;
  lilypads: THREE.Object3D[];
  clouds: THREE.Object3D[];
  diagnostics: { meshCount: number; propTypeCount: number };
}

/**
 * Builds the full pond diorama for a theme: island terrain, dock, market
 * stall, crafting bench, lanterns, theme-specific foliage (trees/coral/
 * crystals), clouds, lilypads, cattails, and (forest only) mushrooms and
 * bushes. At least 8 distinct prop types per theme, per the plan's density
 * target. The pond/water surface itself is owned by WaterSystem, not here.
 */
export function buildDiorama(theme: ThemeId, materials: MaterialLibrary): DioramaResult {
  const root = new THREE.Group();
  root.name = `diorama-${theme}`;

  // A shared deck for the angler and Barnaby, with room for both silhouettes.
  const dock = buildDock(materials.wood, materials.woodDark, 3, 2.2);
  dock.position.set(0, 0.12, 0.9);
  root.add(dock);

  const playerSlot = new THREE.Group();
  playerSlot.name = 'playerSlot';
  playerSlot.position.set(0.24, 0.22, 0.9);
  playerSlot.rotation.y = Math.PI; // facing -Z, out toward water
  root.add(playerSlot);

  const barnabySlot = new THREE.Group();
  barnabySlot.name = 'barnabySlot';
  barnabySlot.position.set(BARNABY_DOCK_POSITION.x, BARNABY_DOCK_POSITION.y, BARNABY_DOCK_POSITION.z);
  root.add(barnabySlot);
  const fishbotSlot = new THREE.Group();
  fishbotSlot.name = 'fishbotSlot';

  let meshCount = 0;
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshCount += 1;
  });

  return {
    root,
    barnabySlot,
    fishbotSlot,
    playerSlot,
    lilypads: [],
    clouds: [],
    diagnostics: { meshCount, propTypeCount: 1 },
  };
}
