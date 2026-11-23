import * as THREE from 'three';

/**
 * Procedural voxel/prop factories. Everything here returns THREE.Object3D
 * (or InstancedMesh for repeated detail) built from primitive geometry —
 * no external assets. Shared materials come from MaterialLibrary; this file
 * only owns shape/placement.
 */

let sharedVoxelGeometry: THREE.BoxGeometry | null = null;
export function voxelGeometry(): THREE.BoxGeometry {
  if (!sharedVoxelGeometry) sharedVoxelGeometry = new THREE.BoxGeometry(1, 1, 1);
  return sharedVoxelGeometry;
}

export interface VoxelCell {
  x: number;
  y: number;
  z: number;
  color: THREE.ColorRepresentation;
  scale?: number;
}

/**
 * Builds one InstancedMesh from a list of voxel cells sharing a unit cube
 * geometry, with per-instance color. This is how terrain/foliage/prop
 * clusters stay cheap (one draw call per cluster instead of one per cube).
 */
export function buildVoxelCluster(
  cells: VoxelCell[],
  material: THREE.Material,
  cellSize = 1,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(voxelGeometry(), material, cells.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  cells.forEach((cell, index) => {
    const scale = (cell.scale ?? 1) * cellSize;
    matrix.makeScale(scale, scale, scale);
    matrix.setPosition(cell.x * cellSize, cell.y * cellSize, cell.z * cellSize);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, color.set(cell.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/**
 * Layered island terrain block with a carved-out pond basin: grass top,
 * dirt mid-band, dark stone base, irregular footprint. Cells inside
 * `pondRadius` are left empty on the top layer so the WaterSystem disc
 * (sized to roughly match) shows through instead of being buried under
 * solid terrain.
 */
export function buildIslandTerrain(
  materials: { top: THREE.Material; mid: THREE.Material; low: THREE.Material },
  radius = 5,
  pondRadius = 3,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'islandTerrain';

  const topCells: VoxelCell[] = [];
  const midCells: VoxelCell[] = [];
  const lowCells: VoxelCell[] = [];

  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      const dist = Math.sqrt(x * x + z * z);
      const edgeNoise = (Math.sin(x * 1.7) + Math.cos(z * 1.3)) * 0.4;
      if (dist <= radius + edgeNoise && dist >= pondRadius) {
        topCells.push({ x, y: 0, z, color: 0xffffff });
      }
    }
  }
  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      const dist = Math.sqrt(x * x + z * z);
      if (dist <= radius - 1 && dist >= pondRadius) {
        midCells.push({ x, y: -1, z, color: 0xffffff });
        if (dist > radius - 2.5) {
          lowCells.push({ x, y: -2, z, color: 0xffffff });
        }
      } else if (dist < pondRadius) {
        // Floor of the pond (prevents seeing through to the skybox)
        lowCells.push({ x, y: -1, z, color: 0xffffff });
      }
    }
  }

  group.add(buildVoxelCluster(topCells, materials.top));
  group.add(buildVoxelCluster(midCells, materials.mid));
  group.add(buildVoxelCluster(lowCells, materials.low));
  return group;
}

/** A simple faceted low-poly rock from a jittered icosahedron — no external assets needed. */
export function buildRock(material: THREE.Material, size = 0.6): THREE.Mesh {
  const geometry = new THREE.IcosahedronGeometry(size, 0);
  const position = geometry.attributes.position;
  const jitter = size * 0.18;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(
      i,
      position.getX(i) + (Math.random() - 0.5) * jitter,
      position.getY(i) + (Math.random() - 0.5) * jitter,
      position.getZ(i) + (Math.random() - 0.5) * jitter,
    );
  }
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Conical pine tree: trunk cylinder + stacked cone tiers, for the forest-pond theme. */
export function buildPineTree(
  trunkMaterial: THREE.Material,
  foliageMaterial: THREE.Material,
  height = 2.2,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'pineTree';

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, height * 0.4, 6), trunkMaterial);
  trunk.position.y = height * 0.2;
  trunk.castShadow = true;
  group.add(trunk);

  const tierCount = 3;
  for (let i = 0; i < tierCount; i++) {
    const tierHeight = height * 0.5 * (1 - i * 0.18);
    const tierRadius = 0.55 * (1 - i * 0.22);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(tierRadius, tierHeight, 7), foliageMaterial);
    cone.position.y = height * 0.42 + i * height * 0.24;
    cone.castShadow = true;
    group.add(cone);
  }
  return group;
}

/** Branching coral: a bent tube plus small knob clusters, for the ocean-trench theme. */
export function buildCoral(material: THREE.Material, accentMaterial: THREE.Material, height = 1.4): THREE.Group {
  const group = new THREE.Group();
  group.name = 'coral';

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.15, height * 0.4, -0.05),
    new THREE.Vector3(-0.1, height * 0.75, 0.1),
    new THREE.Vector3(0.2, height, 0),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.08, 6, false), material);
  tube.castShadow = true;
  group.add(tube);

  for (let i = 0; i < 4; i++) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.05, 6, 6), accentMaterial);
    const t = 0.3 + i * 0.18;
    const point = curve.getPoint(Math.min(1, t));
    knob.position.copy(point);
    knob.castShadow = true;
    group.add(knob);
  }
  return group;
}

/** Faceted crystal shard cluster for the cosmic-lake theme. */
export function buildCrystalCluster(material: THREE.Material, baseHeight = 1.2): THREE.Group {
  const group = new THREE.Group();
  group.name = 'crystalCluster';

  const shardCount = 4 + Math.floor(Math.random() * 2);
  for (let i = 0; i < shardCount; i++) {
    const height = baseHeight * (0.5 + Math.random() * 0.6);
    const radius = 0.12 + Math.random() * 0.08;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), material);
    const angle = (i / shardCount) * Math.PI * 2;
    shard.position.set(Math.cos(angle) * 0.15, height / 2, Math.sin(angle) * 0.15);
    shard.rotation.z = (Math.random() - 0.5) * 0.3;
    shard.rotation.x = (Math.random() - 0.5) * 0.2;
    shard.castShadow = true;
    group.add(shard);
  }
  return group;
}

export function buildDock(
  woodMaterial: THREE.Material,
  darkWoodMaterial: THREE.Material,
  length = 4,
  width = 1.05,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dock';

  const plankGeometry = new THREE.BoxGeometry(width, 0.10, 0.38);
  for (let i = -3; i < length; i++) {
    const plank = new THREE.Mesh(plankGeometry, woodMaterial);
    plank.position.set(0, 0, -i * 0.42);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }

  const postGeometry = new THREE.CylinderGeometry(0.07, 0.09, 0.9, 8);
  const postOffsets = [-width / 2 + 0.1, width / 2 - 0.1];
  for (let i = -2; i < length; i += 2) {
    for (const offsetX of postOffsets) {
      const post = new THREE.Mesh(postGeometry, darkWoodMaterial);
      post.position.set(offsetX, -0.42, -i * 0.42);
      post.castShadow = true;
      group.add(post);
    }
  }

  return group;
}

/** Market-stall shell: posts, roof slab, counter — Barnaby's GLB stands behind it. */
export function buildMarketStall(woodMaterial: THREE.Material, roofMaterial: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'marketStall';

  const postGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6);
  const postPositions: [number, number][] = [
    [-0.9, -0.7],
    [0.9, -0.7],
    [-0.9, 0.7],
    [0.9, 0.7],
  ];
  for (const [x, z] of postPositions) {
    const post = new THREE.Mesh(postGeometry, woodMaterial);
    post.position.set(x, 0.7, z);
    post.castShadow = true;
    group.add(post);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 1.7), roofMaterial);
  roof.position.y = 1.42;
  roof.castShadow = true;
  group.add(roof);

  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.5), woodMaterial);
  counter.position.set(0, 0.25, 0.6);
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);

  return group;
}

/** Crafting bench: a low table with a small anvil-block on top. */
export function buildCraftingBench(woodMaterial: THREE.Material, stoneMaterial: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'craftingBench';

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.7), woodMaterial);
  top.position.y = 0.6;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const legGeometry = new THREE.BoxGeometry(0.1, 0.6, 0.1);
  const legOffsets: [number, number][] = [
    [-0.5, -0.28],
    [0.5, -0.28],
    [-0.5, 0.28],
    [0.5, 0.28],
  ];
  for (const [x, z] of legOffsets) {
    const leg = new THREE.Mesh(legGeometry, woodMaterial);
    leg.position.set(x, 0.3, z);
    leg.castShadow = true;
    group.add(leg);
  }

  const block = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.3), stoneMaterial);
  block.position.y = 0.78;
  block.castShadow = true;
  group.add(block);

  return group;
}

/** Lantern post: pole + glowing box head. */
export function buildLanternPost(
  woodMaterial: THREE.Material,
  glowMaterial: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial,
  height = 1.4,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lanternPost';

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, height, 6), woodMaterial);
  pole.position.y = height / 2;
  pole.castShadow = true;
  group.add(pole);

  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), glowMaterial);
  lantern.position.y = height + 0.1;
  group.add(lantern);

  const light = new THREE.PointLight(glowMaterial.color, 0.35, 2.5, 2);
  light.position.copy(lantern.position);
  group.add(light);

  return group;
}

/** Flat lilypad with a small bud, floats on the water surface. */
export function buildLilypad(material: THREE.Material, budMaterial?: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lilypad';

  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10), material);
  pad.rotation.x = -Math.PI / 2;
  const notch = Math.random() * Math.PI * 2;
  pad.rotation.z = notch;
  group.add(pad);

  if (budMaterial && Math.random() > 0.5) {
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), budMaterial);
    bud.position.set(0.1, 0.04, 0.05);
    group.add(bud);
  }
  return group;
}

/** Reed/cattail cluster near the shoreline. */
export function buildCattails(stemMaterial: THREE.Material, headMaterial: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cattails';

  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const stemHeight = 0.5 + Math.random() * 0.3;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, stemHeight, 5), stemMaterial);
    const offsetX = (Math.random() - 0.5) * 0.3;
    const offsetZ = (Math.random() - 0.5) * 0.3;
    stem.position.set(offsetX, stemHeight / 2, offsetZ);
    stem.rotation.z = (Math.random() - 0.5) * 0.2;
    group.add(stem);

    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 6), headMaterial);
    head.position.set(offsetX, stemHeight * 0.85, offsetZ);
    head.rotation.z = stem.rotation.z;
    group.add(head);
  }
  return group;
}

/** Rounded bush cluster. */
export function buildBush(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bush';
  const blobCount = 3;
  for (let i = 0; i < blobCount; i++) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.2 + Math.random() * 0.08, 7, 6), material);
    blob.position.set((Math.random() - 0.5) * 0.25, 0.15 + Math.random() * 0.1, (Math.random() - 0.5) * 0.25);
    blob.castShadow = true;
    group.add(blob);
  }
  return group;
}

/** Small mushroom cluster (2-3 caps), a cozy-forest set-dressing detail. */
export function buildMushroomCluster(stemMaterial: THREE.Material, capMaterial: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'mushroomCluster';
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const scale = 0.5 + Math.random() * 0.5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * scale, 0.04 * scale, 0.12 * scale, 6), stemMaterial);
    const offsetX = (Math.random() - 0.5) * 0.2;
    const offsetZ = (Math.random() - 0.5) * 0.2;
    stem.position.set(offsetX, 0.06 * scale, offsetZ);
    group.add(stem);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08 * scale, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMaterial);
    cap.position.set(offsetX, 0.12 * scale, offsetZ);
    group.add(cap);
  }
  return group;
}

/** Simple drifting cloud: overlapping soft spheres, unlit for a flat cutout look. */
export function buildCloud(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'cloud';
  const blobCount = 4;
  for (let i = 0; i < blobCount; i++) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.2, 8, 6), material);
    blob.position.set(i * 0.5 - blobCount * 0.25, Math.random() * 0.15, (Math.random() - 0.5) * 0.3);
    group.add(blob);
  }
  return group;
}

/**
 * Hand-crafted balsa miniature pier: individual slightly varied carved planks,
 * stringer rails underneath, stout round pilings with peg caps & hemp rope wraps.
 */
export function buildTactileDock(
  woodMaterial: THREE.Material,
  darkWoodMaterial: THREE.Material,
  ropeMaterial: THREE.Material,
  length = 4,
  width = 2.2,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'tactileDock';

  const plankShape = new THREE.Shape();
  const pw = width;
  const ph = 0.085;
  const chamfer = 0.018;
  plankShape.moveTo(-pw / 2 + chamfer, 0);
  plankShape.lineTo(pw / 2 - chamfer, 0);
  plankShape.lineTo(pw / 2, chamfer);
  plankShape.lineTo(pw / 2, ph - chamfer);
  plankShape.lineTo(pw / 2 - chamfer, ph);
  plankShape.lineTo(-pw / 2 + chamfer, ph);
  plankShape.lineTo(-pw / 2, ph - chamfer);
  plankShape.lineTo(-pw / 2, chamfer);
  plankShape.closePath();

  const plankGeometry = new THREE.ExtrudeGeometry(plankShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 1,
  });
  plankGeometry.translate(0, -0.04, -0.17);

  const dummy = new THREE.Object3D();
  const plankCount = Math.max(0, length + 3);
  const planks = new THREE.InstancedMesh(plankGeometry, woodMaterial, plankCount);
  planks.castShadow = true;
  planks.receiveShadow = true;
  for (let idx = 0; idx < plankCount; idx++) {
    const i = idx - 3;
    dummy.position.set(0, Math.sin(i * 2.1) * 0.004, -i * 0.39);
    dummy.rotation.set(0, Math.cos(i * 1.7) * 0.012, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    planks.setMatrixAt(idx, dummy.matrix);
  }
  planks.instanceMatrix.needsUpdate = true;
  group.add(planks);

  // Sub-deck cedar stringers
  const deckSpan = (length + 2.5) * 0.39;
  const stringerGeo = new THREE.BoxGeometry(0.11, 0.12, deckSpan);
  for (const sx of [-width * 0.36, 0, width * 0.36]) {
    const stringer = new THREE.Mesh(stringerGeo, darkWoodMaterial);
    stringer.position.set(sx, -0.09, -(length - 4) * 0.19);
    stringer.castShadow = false;
    group.add(stringer);
  }

  // Round dock pilings rising slightly as short corner bollards + rope collars
  const postGeometry = new THREE.CylinderGeometry(0.082, 0.098, 1.08, 7);
  const capGeometry = new THREE.CylinderGeometry(0.092, 0.088, 0.04, 7);
  const ropeGeo = new THREE.TorusGeometry(0.092, 0.016, 5, 10);
  const postOffsetsX = [-width / 2 + 0.18, -0.66, 0.66, width / 2 - 0.18];
  const zIndices = [-2, 0, 2];
  const totalPosts = zIndices.length * postOffsetsX.length;
  const posts = new THREE.InstancedMesh(postGeometry, darkWoodMaterial, totalPosts);
  posts.castShadow = true;
  posts.receiveShadow = true;
  const caps = new THREE.InstancedMesh(capGeometry, woodMaterial, totalPosts);
  caps.castShadow = false;
  const ropeTransforms: THREE.Matrix4[] = [];

  let postIdx = 0;
  for (const zIdx of zIndices) {
    const pz = -zIdx * 0.39;
    for (const px of postOffsetsX) {
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(px, -0.35, pz);
      dummy.updateMatrix();
      posts.setMatrixAt(postIdx, dummy.matrix);

      dummy.position.set(px, 0.20, pz);
      dummy.updateMatrix();
      caps.setMatrixAt(postIdx, dummy.matrix);
      postIdx += 1;

      if (Math.abs(px) > 0.55 && zIdx <= 0) {
        dummy.position.set(px, 0.13, pz);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        ropeTransforms.push(dummy.matrix.clone());
      }
    }
  }
  posts.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  group.add(posts, caps);

  if (ropeTransforms.length > 0) {
    const ropes = new THREE.InstancedMesh(ropeGeo, ropeMaterial, ropeTransforms.length);
    ropes.castShadow = false;
    ropeTransforms.forEach((m, i) => ropes.setMatrixAt(i, m));
    ropes.instanceMatrix.needsUpdate = true;
    group.add(ropes);
  }

  return group;
}

/** Lush sponge-flocked shoreline mound with layered shrubs and smooth pebbles. */
export function buildFlockedShoreBank(
  foliageMaterial: THREE.Material,
  accentMaterial: THREE.Material,
  stoneMaterial: THREE.Material,
  terrainMaterial: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'flockedShoreBank';

  const earth = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.35, 0.42, 8), terrainMaterial);
  earth.scale.set(1.3, 1, 0.85);
  earth.position.y = 0.05;
  earth.receiveShadow = true;
  earth.castShadow = true;
  group.add(earth);

  const puffs: Array<[number, number, number, number, boolean]> = [
    [-0.65, 0.38, -0.1, 0.42, false],
    [-0.22, 0.52, -0.25, 0.48, true],
    [0.24, 0.42, -0.05, 0.38, false],
    [0.58, 0.32, 0.12, 0.30, true],
    [-0.42, 0.72, -0.35, 0.36, false],
    [0.05, 0.68, -0.32, 0.34, true],
    [-0.85, 0.58, -0.38, 0.35, true],
  ];
  const dummy = new THREE.Object3D();
  const sphereUnitGeo = new THREE.SphereGeometry(1, 8, 6);
  const basePuffs = puffs.filter(([, , , , accent]) => !accent);
  const accentPuffs = puffs.filter(([, , , , accent]) => accent);

  const addPuffInstances = (items: typeof puffs, material: THREE.Material) => {
    const mesh = new THREE.InstancedMesh(sphereUnitGeo, material, items.length);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    items.forEach(([x, y, z, r], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(r * 1.12, r * 0.88, r);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  };
  addPuffInstances(basePuffs, foliageMaterial);
  addPuffInstances(accentPuffs, accentMaterial);

  const rocks: Array<[number, number, number, number]> = [
    [-0.1, 0.18, 0.46, 0.18],
    [0.36, 0.16, 0.38, 0.14],
    [-0.55, 0.17, 0.44, 0.16],
  ];
  const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), stoneMaterial, rocks.length);
  pebbles.castShadow = false;
  pebbles.receiveShadow = true;
  rocks.forEach(([x, y, z, s], i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(s * 1.3, s * 0.7, s * 1.05);
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
  });
  pebbles.instanceMatrix.needsUpdate = true;
  group.add(pebbles);

  return group;
}

/** Midground miniature clay cliff bluff topped by a mossy plateau for the Meshy shack. */
export function buildMiniatureCliffBluff(
  stoneMaterial: THREE.Material,
  topMaterial: THREE.Material,
  foliageMaterial: THREE.Material,
  accentMaterial: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'miniatureCliffBluff';

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.48, 0.88, 8), stoneMaterial);
  base.scale.set(1.22, 1, 0.98);
  base.position.y = 0.42;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.36, 8), stoneMaterial);
  upper.scale.set(1.16, 1, 0.95);
  upper.position.set(-0.04, 0.96, 0);
  upper.castShadow = false;
  upper.receiveShadow = true;
  group.add(upper);

  const mossCap = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.02, 0.14, 8), topMaterial);
  mossCap.scale.set(1.16, 1, 0.95);
  mossCap.position.set(-0.04, 1.17, 0);
  mossCap.receiveShadow = true;
  group.add(mossCap);

  // Flocked foliage tufts framing the shack base
  const shrubs: Array<[number, number, number, number, boolean]> = [
    [-0.82, 1.24, 0.38, 0.26, false],
    [-0.58, 1.28, 0.56, 0.22, true],
    [0.72, 1.24, 0.35, 0.24, false],
    [0.52, 0.96, 0.72, 0.28, true],
    [-0.96, 0.62, 0.62, 0.32, false],
  ];
  for (const [x, y, z, r, accent] of shrubs) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), accent ? accentMaterial : foliageMaterial);
    puff.position.set(x, y, z);
    puff.scale.set(1.1, 0.82, 1);
    puff.castShadow = false;
    group.add(puff);
  }

  return group;
}

/** Towering sculpted spun-cotton cumulus mound for Ghibli horizon depth. */
export function buildSpunCottonCloud(cloudMaterial: THREE.Material, scale = 1.0): THREE.Group {
  const group = new THREE.Group();
  group.name = 'spunCottonCloud';

  const lobes: Array<[number, number, number, number]> = [
    [0, 0.45, 0, 0.72],
    [-0.68, 0.24, 0.12, 0.56],
    [0.68, 0.26, 0.08, 0.58],
    [-0.3, 0.9, -0.06, 0.56],
    [0.34, 0.86, -0.04, 0.54],
    [0.02, 1.24, -0.08, 0.48],
  ];

  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), cloudMaterial, lobes.length);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const dummy = new THREE.Object3D();
  lobes.forEach(([x, y, z, r], i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(r, r, r);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  group.scale.setScalar(scale);
  return group;
}

/** Small carved balsa bait crate set on the dock deck. */
export function buildDockBaitCrate(woodMaterial: THREE.Material, darkWoodMaterial: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dockBaitCrate';
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.18), woodMaterial);
  box.position.y = 0.08;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.20), darkWoodMaterial);
  rim.position.y = 0.165;
  rim.castShadow = true;
  group.add(rim);
  return group;
}

/** Coiled hemp mooring rope resting neatly on the dock. */
export function buildRopeCoil(ropeMaterial: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dockRopeCoil';
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085 - i * 0.014, 0.018, 5, 10), ropeMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.018 + i * 0.024;
    ring.castShadow = false;
    group.add(ring);
  }
  return group;
}
