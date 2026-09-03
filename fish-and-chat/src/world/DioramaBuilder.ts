import * as THREE from 'three';
import type { MaterialLibrary } from '../assets/MaterialLibrary';
import type { ThemeId } from '../game/data';
import { SEATED_HIP_HEIGHT } from '../entities/character/PlayerCharacter';
import {
  buildBush,
  buildCattails,
  buildCloud,
  buildCoral,
  buildCraftingBench,
  buildCrate,
  buildCrystalCluster,
  buildDock,
  buildIslandTerrain,
  buildLanternPost,
  buildLilypad,
  buildMarketStall,
  buildMushroomCluster,
  buildPineTree,
  buildRock,
  CRATE_SIZE,
} from './VoxelKit';

/** Radius of the carved-out pond hole in the island terrain; WaterSystem's disc should be slightly smaller so the terrain rim overlaps its edge. */
export const POND_RADIUS = 3.0;
export const WATER_DISC_RADIUS = 2.85;

/**
 * Top surface of the island. buildIslandTerrain lays its grass layer as unit
 * cubes centred on y=0, so the walkable ground is half a cube up — which is
 * why every structure below is placed at ~0.5 rather than 0. Anything given
 * y=0 is buried to its waist.
 */
export const GROUND_Y = 0.5;

/**
 * Where the angler's crate sits, on the near-left bank. Its distance from the
 * centre (~3.6) has to clear POND_RADIUS by more than the crate's own bounding
 * half-diagonal, or the crate's waterward corner hangs over the carved rim and
 * the terrain's exposed stone layer cuts across the angler from this low
 * camera.
 *
 * The whole scene is composed around this point: the camera sits back over its
 * shoulder, so every interactable prop has to live to its right or across the
 * water, never behind it.
 */
export const ANGLER_SEAT = new THREE.Vector3(-2.37, GROUND_Y, 2.71);

/**
 * The point out on the water the angler (and therefore the camera) faces.
 * Past the pond centre, and aimed a little above the surface: sighting exactly
 * on the water pitches the camera down far enough that the near bank eats the
 * bottom of the frame. Only the x/z of this are used to place the camera (the
 * rig flattens the axis) — the y is purely how far up the shot is tilted.
 */
export const ANGLER_WATER_FOCUS = new THREE.Vector3(0.1, 0.2, -0.9);

/** Facing angle that turns the seat (and the character on it) toward the water. */
export const ANGLER_FACING_Y = Math.atan2(
  ANGLER_WATER_FOCUS.x - ANGLER_SEAT.x,
  ANGLER_WATER_FOCUS.z - ANGLER_SEAT.z,
);

export interface DioramaResult {
  root: THREE.Group;
  /** Empty anchor group where Barnaby's GLB is attached, positioned at the market stall. */
  barnabySlot: THREE.Group;
  /** Empty anchor group where the fishbot's GLB is attached, positioned on the dock. */
  fishbotSlot: THREE.Group;
  /** Empty anchor group where the player's voxel character is attached, seated on the crate. */
  playerSlot: THREE.Group;
  /** The tipped-over crate the player sits on, at ANGLER_SEAT. */
  anglerCrate: THREE.Object3D;
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
  { x: 2.9, z: -1.5, radius: 1.6 }, // market stall (far-right bank, in frame)
  { x: 2.15, z: -2.0, radius: 1.1 }, // Barnaby (in the open beside the stall) — matches barnabySlot below
  { x: 1.4, z: 2.5, radius: 1.6 }, // dock walkway (extended landward)
  { x: -2.9, z: -1.9, radius: 1.1 }, // crafting bench (far-left bank)
  { x: -2.2, z: -3.4, radius: 0.5 }, // lantern
  { x: 3.4, z: -2.6, radius: 0.5 }, // lantern
  { x: 2.1, z: 2.5, radius: 0.5 }, // shore boot
  { x: ANGLER_SEAT.x, z: ANGLER_SEAT.z, radius: 1.2 }, // angler's crate and the space around it
];

function isExcluded(x: number, z: number, margin = 0): boolean {
  // Nothing tall between the camera and the pond. The over-the-shoulder rig
  // sits back past the near-left bank looking across the water, so the whole
  // near-field wedge behind and beside the angler has to stay open — a single
  // scattered pine at (-3, 4) otherwise fills half the shot.
  if (z > 3.0 && x < 1.0) {
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

  // Far-right bank. The camera now looks across the pond from the angler's
  // left-hand seat, so everything the player clicks has to sit on the water's
  // far or right shore — the old landward positions are behind the lens.
  const stall = buildMarketStall(materials.wood, materials.woodDark);
  stall.position.set(2.9, 0.5, -1.5);
  stall.rotation.y = -Math.PI * 0.62; // counter turned back toward the pond/camera
  stall.scale.setScalar(0.72);
  root.add(stall);
  track(stall, 'marketStall');

  // Clearly in the open beside the stall rather than under its roof, which
  // would occlude him from the fixed camera. Faces back across the pond so
  // he is greeting the angler, and stays clickable for selling.
  const barnabyPos = { x: 2.15, z: -2.0 };
  const barnabySlot = new THREE.Group();
  barnabySlot.name = 'barnabySlot';
  barnabySlot.position.set(barnabyPos.x, 0.5, barnabyPos.z);
  // The FBX faces -X natively (see Game.ts's Barnaby walk heading), so this
  // turns him toward the angler's seat across the water.
  barnabySlot.rotation.y =
    Math.atan2(ANGLER_SEAT.x - barnabyPos.x, ANGLER_SEAT.z - barnabyPos.z) - Math.PI / 2;
  root.add(barnabySlot);

  // Far-left bank, across the water from the angler — reads as background
  // detail on the left of frame without crowding the seat in the foreground.
  const bench = buildCraftingBench(materials.wood, materials.stone);
  bench.position.set(-2.9, 0.5, -1.9);
  bench.rotation.y = 0.9;
  root.add(bench);
  track(bench, 'craftingBench');

  // Aligned with the dock's plank line (x=1.4) near its far end, so the bot reads as standing on the dock.
  const fishbotSlot = new THREE.Group();
  fishbotSlot.name = 'fishbotSlot';
  fishbotSlot.position.set(1.4, 0.56, 2.05); // nudged landward to make room for lantern
  root.add(fishbotSlot);

  // The crate the angler sits on: a shipping crate knocked onto its side at
  // the water's edge. The mouth (local +Z) is turned a quarter-turn along the
  // shore rather than toward the water or the bank: pointed at the bank it
  // faces the camera dead-on and reads as a black hole, pointed at the water
  // it's hidden altogether and the crate is just a box. In profile you get the
  // slatted side and enough of the opening to see it's been tipped over.
  const anglerCrate = buildCrate(materials.wood, materials.woodDark);
  anglerCrate.position.set(ANGLER_SEAT.x, GROUND_Y, ANGLER_SEAT.z);
  anglerCrate.rotation.y = ANGLER_FACING_Y + Math.PI / 2;
  root.add(anglerCrate);
  track(anglerCrate, 'crate');

  // Seated, not standing: the character's hips have to land on the crate's
  // top face, and the rig's group origin is at its FEET (see
  // PlayerCharacter's FEET_OFFSET). With the legs swung forward by the seated
  // posture the hips sit one leg-length above that origin, so the slot goes
  // at crate-top minus a leg — i.e. back down near ground level — rather than
  // at the seat height itself.
  const playerSlot = new THREE.Group();
  playerSlot.name = 'playerSlot';
  playerSlot.position.set(
    ANGLER_SEAT.x,
    GROUND_Y + CRATE_SIZE.height - SEATED_HIP_HEIGHT,
    ANGLER_SEAT.z,
  );
  playerSlot.rotation.y = ANGLER_FACING_Y;
  root.add(playerSlot);

  const lanternPositions: [number, number, number][] = [
    // Far-left bank. On the near-left bank (its old spot) this one stands
    // between the camera and the angler and skewers the left of the frame.
    [-2.2, -3.4, 1.4],
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
    anglerCrate,
    lilypads,
    clouds,
    diagnostics: { meshCount, propTypeCount: propTypes.size },
  };
}
