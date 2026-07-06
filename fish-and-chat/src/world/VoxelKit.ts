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
  length = 3,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dock';

  const plankWidth = 0.9;
  const plankGeometry = new THREE.BoxGeometry(plankWidth, 0.12, 0.42);
  // Extend dock landward
  for (let i = -2; i < length; i++) {
    const plank = new THREE.Mesh(plankGeometry, woodMaterial);
    plank.position.set(0, 0, -i * 0.45);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }

  const postGeometry = new THREE.CylinderGeometry(0.07, 0.09, 0.6, 6);
  const postOffsets = [-0.35, 0.35];
  for (let i = -1; i < length; i += 2) {
    for (const offsetX of postOffsets) {
      const post = new THREE.Mesh(postGeometry, darkWoodMaterial);
      post.position.set(offsetX, -0.3, -i * 0.45);
      post.castShadow = true;
      group.add(post);
    }
  }

  // Step up on the left side (left from camera = -x)
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.35), woodMaterial);
  step.position.set(-0.6, -0.15, 0.9); // Landward position near the first planks
  step.castShadow = true;
  step.receiveShadow = true;
  group.add(step);

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
  glowMaterial: THREE.MeshStandardMaterial,
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
