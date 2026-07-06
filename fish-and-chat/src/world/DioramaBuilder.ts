import * as THREE from 'three';
import type { MaterialLibrary } from '../assets/MaterialLibrary';
import type { ThemeId } from '../game/data';
import {
  buildBush,
  buildCattails,
  buildCloud,
  buildCoral,
  buildCraftingBench,
  buildCrystalCluster,
  buildDock,
  buildIslandTerrain,
  buildLanternPost,
  buildLilypad,
  buildMarketStall,
  buildMushroomCluster,
  buildPineTree,
  buildRock,
} from './VoxelKit';

/** Radius of the carved-out pond hole in the island terrain; WaterSystem's disc should be slightly smaller so the terrain rim overlaps its edge. */
export const POND_RADIUS = 3.0;
export const WATER_DISC_RADIUS = 2.85;

export interface DioramaResult {
  root: THREE.Group;
  /** Empty anchor group where Barnaby's GLB is attached, positioned at the market stall. */
  barnabySlot: THREE.Group;
  /** Empty anchor group where the fishbot's GLB is attached, positioned on the dock. */
  fishbotSlot: THREE.Group;
  /** Empty anchor group where the player's voxel character is attached, on its own patch of bank. */
  playerSlot: THREE.Group;
  /** Lilypad instances, animated with a gentle bob in the update loop. */
  lilypads: THREE.Object3D[];
  clouds: THREE.Object3D[];
  diagnostics: { meshCount: number; propTypeCount: number };
}

interface ExclusionZone {
  x: number;
  z: number;
  radius: number;
}

/**
 * Keep scattered foliage/rocks out of the footprints of built structures —
 * without this, the ring scatter happily grows pine trees through the market
 * stall roof.
 */
const STRUCTURE_EXCLUSIONS: ExclusionZone[] = [
  { x: -3.2, z: 2.0, radius: 1.5 }, // market stall (moved & scaled)
  { x: -1.0, z: 3.1, radius: 1.1 }, // Barnaby (in the open, front of stall) — matches barnabySlot below
  { x: 1.4, z: 2.5, radius: 1.6 }, // dock walkway (extended landward)
  { x: -3.6, z: -1.6, radius: 1.1 }, // crafting bench
  { x: -3.4, z: 3.2, radius: 0.5 }, // lantern
  { x: 3.4, z: -2.6, radius: 0.5 }, // lantern
  { x: 2.1, z: 2.5, radius: 0.5 }, // shore boot
  { x: 2.2, z: -2.3, radius: 1.0 }, // player character — own patch of bank, opposite side from Barnaby's stall
];

function isExcluded(x: number, z: number, margin = 0): boolean {
  // Exclude foreground middle-bottom area (blocking camera view of pond)
  if (z > 2.2 && x > -2.0 && x < 2.0) {
    return true;
  }
  return STRUCTURE_EXCLUSIONS.some((zone) => {
    const dx = x - zone.x;
    const dz = z - zone.z;
    return Math.sqrt(dx * dx + dz * dz) < zone.radius + margin;
  });
}

function scatterOnRing(count: number, minRadius: number, maxRadius: number): { x: number; z: number }[] {
  const points: { x: number; z: number }[] = [];
  for (let i = 0; i < count; i++) {
    let found: { x: number; z: number } | null = null;
    for (let attempt = 0; attempt < 12 && !found; attempt++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.9;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!isExcluded(x, z)) found = { x, z };
    }
    // Drop the point rather than force an overlap if 12 samples all collide.
    if (found) points.push(found);
  }
  return points;
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

  const propTypes = new Set<string>();
  let meshCount = 0;
  const track = (object: THREE.Object3D, typeName: string) => {
    propTypes.add(typeName);
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh || (child as THREE.InstancedMesh).isInstancedMesh) meshCount += 1;
    });
  };

  const terrain = buildIslandTerrain(
    { top: materials.terrainTop, mid: materials.terrainMid, low: materials.terrainLow },
    5,
    POND_RADIUS,
  );
  root.add(terrain);
  track(terrain, 'terrain');

  const dock = buildDock(materials.wood, materials.woodDark, 4);
  dock.position.set(1.4, 0.45, POND_RADIUS - 0.15); // raised to 0.45
  root.add(dock);
  track(dock, 'dock');

  const stall = buildMarketStall(materials.wood, materials.woodDark);
  stall.position.set(-3.2, 0.5, 2.0); // raised to 0.5
  stall.rotation.y = Math.PI * 0.15;
  stall.scale.setScalar(0.72);
  root.add(stall);
  track(stall, 'marketStall');

  // Clearly in the open in front of the stall: the rotated roof occludes
  // anything within its footprint from the fixed 3/4 camera, so he stands
  // beside the counter greeting the pond instead of "inside" the shop.
  const barnabySlot = new THREE.Group();
  barnabySlot.name = 'barnabySlot';
  barnabySlot.position.set(-1.0, 0.5, 3.1); // raised to 0.5
  // Rotated 100° counterclockwise from the previous angle per direct visual
  // feedback (he was not actually facing the camera at Math.PI - 0.15).
  barnabySlot.rotation.y = Math.PI - 0.15 + (100 * Math.PI) / 180;
  root.add(barnabySlot);

  const bench = buildCraftingBench(materials.wood, materials.stone);
  bench.position.set(-3.6, 0.5, -1.6); // raised to 0.5
  bench.rotation.y = -0.4;
  root.add(bench);
  track(bench, 'craftingBench');

  // Aligned with the dock's plank line (x=1.4) near its far end, so the bot reads as standing on the dock.
  const fishbotSlot = new THREE.Group();
  fishbotSlot.name = 'fishbotSlot';
  fishbotSlot.position.set(1.4, 0.56, 2.05); // nudged landward to make room for lantern
  root.add(fishbotSlot);

  // Own patch of bank, opposite side of the pond from Barnaby's stall — a
  // quiet solo fishing spot rather than crowding the already-busy foreground.
  const playerSlot = new THREE.Group();
  playerSlot.name = 'playerSlot';
  playerSlot.position.set(2.2, 0.5, -2.3);
  playerSlot.rotation.y = Math.PI * 0.35; // facing roughly toward the pond
  root.add(playerSlot);

  const lanternPositions: [number, number, number][] = [
    [-3.4, 3.2, 1.4],
    [3.4, -2.6, 1.4],
    [1.05, 1.6, 1.0], // Dock lantern
  ];
  for (const [x, z, height] of lanternPositions) {
    const lantern = buildLanternPost(materials.woodDark, materials.emissiveSignal, height);
    if (height === 1.0) {
      // Dock lantern needs to sit on the dock, which is at y=0.05 + 0.12 (plank height)
      lantern.position.set(x, 0.17, z);
    } else {
      lantern.position.set(x, 0, z);
    }
    root.add(lantern);
    track(lantern, 'lanternPost');
  }

  // Theme-specific tall foliage ring around the pond edge.
  const foliagePoints = scatterOnRing(6, 3.6, 4.6);
  for (const point of foliagePoints) {
    let foliage: THREE.Object3D;
    if (theme === 'forest-pond') {
      foliage = buildPineTree(materials.woodDark, materials.foliage, 1.8 + Math.random() * 0.8);
      track(foliage, 'pineTree');
    } else if (theme === 'ocean-trench') {
      foliage = buildCoral(materials.foliage, materials.foliageAccent, 1.0 + Math.random() * 0.6);
      track(foliage, 'coral');
    } else {
      foliage = buildCrystalCluster(materials.foliageAccent, 1.0 + Math.random() * 0.5);
      track(foliage, 'crystalCluster');
    }
    foliage.position.set(point.x, 0, point.z);
    foliage.rotation.y = Math.random() * Math.PI * 2;
    root.add(foliage);
  }

  // Static tree directly across the lake (middle top) so it is not in the way of the player's view
  let staticFoliage: THREE.Object3D;
  if (theme === 'forest-pond') {
    staticFoliage = buildPineTree(materials.woodDark, materials.foliage, 2.4);
    track(staticFoliage, 'pineTree');
  } else if (theme === 'ocean-trench') {
    staticFoliage = buildCoral(materials.foliage, materials.foliageAccent, 1.5);
    track(staticFoliage, 'coral');
  } else {
    staticFoliage = buildCrystalCluster(materials.foliageAccent, 1.4);
    track(staticFoliage, 'crystalCluster');
  }
  staticFoliage.position.set(0, 0, -4.2);
  root.add(staticFoliage);

  // Rocks scattered near the shoreline, theme-agnostic.
  const rockPoints = scatterOnRing(5, 2.6, 3.6);
  for (const point of rockPoints) {
    const rock = buildRock(materials.stone, 0.25 + Math.random() * 0.25);
    rock.position.set(point.x, 0.1, point.z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    root.add(rock);
    track(rock, 'rock');
  }

  // Cattails right at the shoreline (straddling the pond's carved edge, not floating mid-pond).
  const cattailPoints = scatterOnRing(4, POND_RADIUS - 0.1, POND_RADIUS + 0.4);
  for (const point of cattailPoints) {
    // Warm wood heads, not woodDark — the dark version reads as dirt specks
    // from the diorama camera distance.
    const cattails = buildCattails(materials.foliage, materials.wood);
    cattails.position.set(point.x, 0.05, point.z);
    root.add(cattails);
    track(cattails, 'cattails');
  }

  if (theme === 'forest-pond') {
    const bushPoints = scatterOnRing(4, 3.0, 4.0);
    for (const point of bushPoints) {
      const bush = buildBush(materials.foliageAccent);
      bush.position.set(point.x, 0, point.z);
      root.add(bush);
      track(bush, 'bush');
    }
    const mushroomPoints = scatterOnRing(3, 2.8, 3.6);
    for (const point of mushroomPoints) {
      const mushrooms = buildMushroomCluster(materials.fabric, materials.emissiveSignal);
      mushrooms.position.set(point.x, 0.05, point.z);
      root.add(mushrooms);
      track(mushrooms, 'mushroomCluster');
    }
  }

  // Lilypads float on the pond surface near the center.
  const lilypads: THREE.Object3D[] = [];
  const lilypadCloudMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
  lilypadCloudMaterial.userData.ownedClone = true; // diorama-owned: disposed on theme rebuild
  const lilypadCount = 5;
  for (let i = 0; i < lilypadCount; i++) {
    const angle = (i / lilypadCount) * Math.PI * 2;
    const radius = 1.1 + Math.random() * 1.2;
    const lilypad = buildLilypad(materials.foliageAccent, lilypadCloudMaterial);
    lilypad.position.set(Math.cos(angle) * radius, 0.02, Math.sin(angle) * radius);
    root.add(lilypad);
    lilypads.push(lilypad);
  }
  track(lilypads[0], 'lilypad');

  // Drifting clouds high above the island (forest theme reads best with visible sky clouds).
  const clouds: THREE.Object3D[] = [];
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, fog: false });
  cloudMaterial.userData.ownedClone = true; // diorama-owned: disposed on theme rebuild
  const cloudCount = 3;
  for (let i = 0; i < cloudCount; i++) {
    const cloud = buildCloud(cloudMaterial);
    // High and far back, squashed wide — at small scale and low altitude a
    // sphere cluster reads as an angular white artifact over the island rim.
    cloud.position.set((i - 1) * 6 + Math.random() * 2, 6 + Math.random() * 1.5, -9 - Math.random() * 3);
    cloud.scale.set(2.2 + Math.random() * 0.8, 0.9, 1.3);
    root.add(cloud);
    clouds.push(cloud);
  }
  track(clouds[0], 'cloud');

  return {
    root,
    barnabySlot,
    fishbotSlot,
    playerSlot,
    lilypads,
    clouds,
    diagnostics: { meshCount, propTypeCount: propTypes.size },
  };
}
