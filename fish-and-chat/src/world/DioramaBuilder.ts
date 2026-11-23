import * as THREE from 'three';
import { loadImportedAsset, normalizedClone } from '../assets/ImportedAssetRegistry';
import { MODEL_SOURCE_MANIFEST_PUBLIC } from '../assets/manifest';
import type { MaterialLibrary } from '../assets/MaterialLibrary';
import type { ThemeId } from '../game/data';
import {
  buildBush,
  buildCattails,
  buildCoral,
  buildCrystalCluster,
  buildDockBaitCrate,
  buildFlockedShoreBank,
  buildLilypad,
  buildMiniatureCliffBluff,
  buildMushroomCluster,
  buildRock,
  buildRopeCoil,
  buildSpunCottonCloud,
  buildTactileDock,
} from './VoxelKit';

export const BARNABY_DOCK_POSITION = { x: -0.35, y: 0.175, z: 0.88 } as const;

export interface DioramaResult {
  root: THREE.Group;
  barnabySlot: THREE.Group;
  fishbotSlot: THREE.Group;
  playerSlot: THREE.Group;
  lilypads: THREE.Object3D[];
  clouds: THREE.Object3D[];
  diagnostics: { meshCount: number; propTypeCount: number };
}

function attachAsyncAsset(
  root: THREE.Group,
  slot: THREE.Group,
  url: string,
  targetHeight: number,
  castShadow = false,
): void {
  void loadImportedAsset(url)
    .then((asset) => {
      if (root.userData.disposed) return;

      // Dispose and clear temporary fallback geometry before mounting the GLB.
      slot.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && !mesh.userData.sharedAsset) {
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (mat?.userData.ownedClone) mat.dispose();
          }
        }
      });
      slot.clear();

      const model = normalizedClone(asset, targetHeight);
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.userData.sharedAsset = true;
          mesh.castShadow = castShadow;
          mesh.receiveShadow = true;
        }
      });
      slot.add(model);
    })
    .catch((err) => {
      console.warn(`Failed to load diorama prop ${url}; keeping fallback:`, err);
    });
}

function buildFallbackCabin(wood: THREE.Material, darkWood: THREE.Material, glow: THREE.Material): THREE.Group {
  const cabin = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.54), wood);
  body.position.y = 0.21;
  body.castShadow = true;
  body.receiveShadow = true;
  cabin.add(body);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.34, 4), darkWood);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.56;
  roof.castShadow = true;
  cabin.add(roof);

  const win = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.04), glow);
  win.position.set(0, 0.24, 0.27);
  cabin.add(win);
  return cabin;
}

function buildFallbackLantern(darkWood: THREE.Material, glow: THREE.Material): THREE.Group {
  const lantern = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), glow);
  housing.position.y = 0.08;
  lantern.add(housing);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.08, 4), darkWood);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = 0.19;
  lantern.add(cap);
  return lantern;
}

function buildFallbackChest(wood: THREE.Material, darkWood: THREE.Material): THREE.Group {
  const chest = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.2), wood);
  base.position.y = 0.09;
  base.castShadow = true;
  base.receiveShadow = true;
  chest.add(base);

  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22), darkWood);
  strap.position.y = 0.17;
  strap.castShadow = true;
  chest.add(strap);
  return chest;
}

function createOwnedMaterial(params: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial(params);
  mat.userData.ownedClone = true;
  return mat;
}

/**
 * Builds the Alt-A (Studio Ghibli × Tactile Miniature Toybox Diorama) scene
 * framed tightly for the 318x496 vertical Twitch panel camera.
 */
export function buildDiorama(theme: ThemeId, materials: MaterialLibrary): DioramaResult {
  const root = new THREE.Group();
  root.name = `diorama-${theme}`;

  const propTypes = new Set<string>();
  const lilypads: THREE.Object3D[] = [];
  const clouds: THREE.Object3D[] = [];

  // 1. Hand-carved balsa dock foreground
  const dock = buildTactileDock(materials.wood, materials.woodDark, materials.rope, 4, 2.2);
  dock.position.set(0, 0.12, 0.9);
  root.add(dock);
  propTypes.add('tactile-dock');

  const playerSlot = new THREE.Group();
  playerSlot.name = 'playerSlot';
  playerSlot.position.set(0.25, 0.175, 0.9);
  playerSlot.rotation.y = Math.PI; // facing -Z, out toward water
  root.add(playerSlot);

  const barnabySlot = new THREE.Group();
  barnabySlot.name = 'barnabySlot';
  barnabySlot.position.set(BARNABY_DOCK_POSITION.x, BARNABY_DOCK_POSITION.y, BARNABY_DOCK_POSITION.z);
  root.add(barnabySlot);

  const fishbotSlot = new THREE.Group();
  fishbotSlot.name = 'fishbotSlot';
  fishbotSlot.position.set(-0.34, 0.8, 0.72);
  root.add(fishbotSlot);

  // 2. Dockside iron lantern atop a slender carved balsa post + warm amber glow
  const lanternAnchor = new THREE.Group();
  lanternAnchor.name = 'dockLanternAnchor';
  lanternAnchor.position.set(-0.56, 0.175, 0.30);
  lanternAnchor.rotation.y = 0.42;
  root.add(lanternAnchor);

  const postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.44, 8), materials.woodDark);
  postMesh.position.y = 0.22;
  postMesh.castShadow = false;
  postMesh.receiveShadow = true;
  lanternAnchor.add(postMesh);

  const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.03, 8), materials.wood);
  capMesh.position.y = 0.435;
  capMesh.castShadow = false;
  lanternAnchor.add(capMesh);

  const lanternModelSlot = new THREE.Group();
  lanternModelSlot.position.y = 0.44;
  lanternModelSlot.add(buildFallbackLantern(materials.woodDark, materials.emissiveSignal));
  lanternAnchor.add(lanternModelSlot);

  const lanternCore = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), materials.emissiveSignal);
  lanternCore.position.set(0, 0.56, 0);
  lanternAnchor.add(lanternCore);

  const glowMat = new THREE.MeshBasicMaterial({
    color: materials.emissiveSignal.color,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  glowMat.userData.ownedClone = true;
  const lanternGlow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), glowMat);
  lanternGlow.name = 'dockLanternGlow';
  lanternGlow.position.set(0, 0.56, 0);
  lanternAnchor.add(lanternGlow);

  attachAsyncAsset(root, lanternModelSlot, MODEL_SOURCE_MANIFEST_PUBLIC.dioramaLantern, 0.24);
  propTypes.add('lantern');

  // 3. Brass-strapped balsa tackle chest visible between Barnaby and Angler
  const chestSlot = new THREE.Group();
  chestSlot.name = 'dockChestSlot';
  chestSlot.position.set(-0.06, 0.175, 0.34);
  chestSlot.rotation.y = 0.18;
  chestSlot.add(buildFallbackChest(materials.wood, materials.woodDark));
  root.add(chestSlot);
  attachAsyncAsset(root, chestSlot, MODEL_SOURCE_MANIFEST_PUBLIC.dioramaChest, 0.22);
  propTypes.add('tackle-chest');

  // 4. Right dock balsa bait crate & coiled hemp mooring rope
  const crate = buildDockBaitCrate(materials.wood, materials.woodDark);
  crate.position.set(0.58, 0.175, 0.08);
  crate.rotation.y = -0.24;
  root.add(crate);
  propTypes.add('bait-crate');

  const ropeCoil = buildRopeCoil(materials.rope);
  ropeCoil.position.set(0.44, 0.175, 0.02);
  root.add(ropeCoil);
  propTypes.add('rope-coil');

  // 5. Left midground flocked mossy shore banks
  const shoreBankFront = buildFlockedShoreBank(
    materials.foliage,
    materials.foliageAccent,
    materials.stone,
    materials.terrainLow,
  );
  shoreBankFront.position.set(-1.45, -0.05, -4.8);
  shoreBankFront.rotation.y = 0.28;
  shoreBankFront.scale.setScalar(0.95);
  root.add(shoreBankFront);
  propTypes.add('shore-bank');

  const shoreBankBack = buildFlockedShoreBank(
    materials.foliage,
    materials.foliageAccent,
    materials.stone,
    materials.terrainMid,
  );
  shoreBankBack.position.set(-2.0, -0.05, -6.6);
  shoreBankBack.rotation.y = 0.72;
  shoreBankBack.scale.setScalar(1.08);
  root.add(shoreBankBack);

  // 6. Right midground clay cliff bluff crowned with cliffside fishing shack
  const cliffBluff = buildMiniatureCliffBluff(
    materials.terrainMid,
    materials.terrainTop,
    materials.foliage,
    materials.foliageAccent,
  );
  cliffBluff.position.set(1.42, -0.34, -5.8);
  cliffBluff.rotation.y = -0.45;
  cliffBluff.scale.setScalar(0.82);
  root.add(cliffBluff);
  propTypes.add('cliff-bluff');

  const shackSlot = new THREE.Group();
  shackSlot.name = 'cliffShackSlot';
  shackSlot.position.set(1.38, 0.64, -5.78);
  shackSlot.rotation.y = -0.52;
  shackSlot.add(buildFallbackCabin(materials.wood, materials.woodDark, materials.emissiveSignal));
  root.add(shackSlot);
  attachAsyncAsset(root, shackSlot, MODEL_SOURCE_MANIFEST_PUBLIC.dioramaShack, 0.86);
  propTypes.add('fishing-shack');

  // 7. Theme-specific water & shoreline botanicals / crystals / corals
  const lotusBudMat = createOwnedMaterial({
    color: theme === 'forest-pond' ? '#f7b2bd' : theme === 'ocean-trench' ? '#7fe6ff' : '#d6b6ff',
    emissive: theme === 'cosmic-lake' ? '#8c69ff' : '#000000',
    emissiveIntensity: theme === 'cosmic-lake' ? 0.35 : 0,
  });

  const padPositions: Array<[number, number, number, number]> = [
    [-0.78, 0.0, -1.35, 0.82],
    [-1.08, 0.0, -2.55, 0.92],
    [0.86, 0.0, -2.15, 0.78],
    [-0.96, 0.0, -3.75, 0.88],
  ];
  for (let i = 0; i < padPositions.length; i++) {
    const [px, py, pz, padScale] = padPositions[i];
    const pad = buildLilypad(materials.foliage, i % 2 === 0 ? lotusBudMat : undefined);
    pad.position.set(px, py, pz);
    pad.scale.setScalar(padScale);
    pad.rotation.y = i * 1.3;
    pad.userData.baseY = py;
    pad.userData.phase = i * 1.4;
    root.add(pad);
    lilypads.push(pad);
  }
  propTypes.add('lilypad');

  if (theme === 'forest-pond') {
    const cattailA = buildCattails(materials.foliage, materials.woodDark);
    cattailA.position.set(-1.12, 0.18, -4.25);
    cattailA.scale.setScalar(0.85);
    root.add(cattailA);

    const cattailB = buildCattails(materials.foliage, materials.woodDark);
    cattailB.position.set(0.95, 0.04, -4.9);
    cattailB.rotation.y = 0.8;
    cattailB.scale.setScalar(0.75);
    root.add(cattailB);
    propTypes.add('cattails');

    const mushCapMat = createOwnedMaterial({ color: '#d85c4a' });
    const mushA = buildMushroomCluster(materials.fabric, mushCapMat);
    mushA.position.set(-1.2, 0.32, -4.65);
    root.add(mushA);
    propTypes.add('mushrooms');

    const bush = buildBush(materials.foliage);
    bush.position.set(1.9, 0.1, -4.7);
    bush.scale.setScalar(0.8);
    root.add(bush);
    propTypes.add('bush');
  } else if (theme === 'ocean-trench') {
    const coralMat = createOwnedMaterial({ color: '#ef7b6c' });
    const coralPositions: Array<[number, number, number, number]> = [
      [-1.08, 0.05, -4.2, 0.9],
      [-1.55, 0.3, -4.95, 1.1],
      [0.85, 0.02, -4.95, 0.8],
      [1.25, 0.25, -5.3, 1.0],
    ];
    for (const [cx, cy, cz, h] of coralPositions) {
      const coral = buildCoral(coralMat, materials.emissiveSignal, h);
      coral.position.set(cx, cy, cz);
      root.add(coral);
    }
    propTypes.add('coral');

    const pebble = buildRock(materials.stone, 0.32);
    pebble.position.set(0.92, -0.02, -3.5);
    root.add(pebble);
    propTypes.add('pebble');
  } else {
    const crystalMat = createOwnedMaterial({
      color: '#a991ff',
      emissive: '#7857ff',
      emissiveIntensity: 0.55,
    });
    const crystalPositions: Array<[number, number, number, number]> = [
      [-1.18, 0.25, -4.4, 0.95],
      [-1.62, 0.35, -5.2, 1.15],
      [0.98, 0.12, -5.0, 0.85],
      [1.72, 1.05, -6.1, 0.9],
    ];
    for (const [kx, ky, kz, h] of crystalPositions) {
      const cluster = buildCrystalCluster(crystalMat, h);
      cluster.position.set(kx, ky, kz);
      root.add(cluster);
    }
    propTypes.add('crystal-cluster');

    const nebulaBush = buildBush(materials.foliageAccent);
    nebulaBush.position.set(-1.75, 0.32, -6.2);
    root.add(nebulaBush);
    propTypes.add('bush');
  }

  // 8. Towering spun-cotton Ghibli cumulus clouds across the distant horizon
  const cloudSpecs: Array<[number, number, number, number]> = [
    [-0.2, -0.25, -13.0, 1.25],
    [-2.7, -0.1, -13.8, 0.85],
    [2.8, 0.05, -14.2, 0.78],
  ];
  for (let i = 0; i < cloudSpecs.length; i++) {
    const [cx, cy, cz, cScale] = cloudSpecs[i];
    const cloud = buildSpunCottonCloud(materials.cloud, cScale);
    cloud.position.set(cx, cy, cz);
    cloud.userData.baseX = cx;
    cloud.userData.baseY = cy;
    cloud.userData.phase = i * 1.9;
    root.add(cloud);
    clouds.push(cloud);
  }
  propTypes.add('cotton-cloud');

  let meshCount = 0;
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshCount += 1;
  });

  return {
    root,
    barnabySlot,
    fishbotSlot,
    playerSlot,
    lilypads,
    clouds,
    diagnostics: {
      meshCount,
      propTypeCount: propTypes.size,
    },
  };
}
