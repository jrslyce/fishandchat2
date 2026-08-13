#!/usr/bin/env node
/**
 * Packs a curated subset of the itch.io EmaceArt low-poly nature packs
 * (TerraToon trees + "100 Rocks, Stones & Cliffs") into ONE GLB served from
 * public/models/, so the diorama pays a single request and a single material
 * per palette instead of ~20 of each.
 *
 * Why this script exists at all: the vendor's per-prop GLB exports carry
 * geometry and UVs but NO textures or base-color factors — every prop loads
 * pure white on its own. The color lives in a 32x32 palette atlas shipped
 * beside them in Textures.zip, which the UVs index into. So packing has to
 * reattach that atlas, with NEAREST filtering (bilinear on a 32px palette
 * bleeds neighbouring swatches across every triangle edge).
 *
 * Source archives live on the external assets volume and are NOT in the repo;
 * this script is the record of exactly which props were taken and how.
 * Re-run after mounting the volume:
 *   node scripts/pack-nature-props.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOLUME = '/Volumes/Untitled/Itch Game Dev Assets';
const OUT_GLB = join(ROOT, 'public/models/nature-props.glb');
const OUT_AUDIT_GLB = join(ROOT, 'public/models/nature-props-audit.glb');

const PACKS = {
  trees: {
    zip: join(VOLUME, '06_Nature_and_Landscape/terratoon-stylized-tree-pack-low-poly-forest-foliage/files/glb.zip'),
    texZip: join(VOLUME, '06_Nature_and_Landscape/terratoon-stylized-tree-pack-low-poly-forest-foliage/files/Textures.zip'),
    dir: 'glb',
    atlas: 'Textures/EA02_LPNP-Trees_Colorsheet_v1.png',
  },
  rocks: {
    zip: join(VOLUME, '06_Nature_and_Landscape/l100-rocks-stones-and-clifs/files/glTF.zip'),
    texZip: join(VOLUME, '06_Nature_and_Landscape/l100-rocks-stones-and-clifs/files/Texture.zip'),
    dir: 'glTF',
    atlas: 'Texture/EA01 Rocks and Stone.png',
  },
};

/**
 * The curated subset. Names on the right become the prop ids the diorama asks
 * for, so they describe silhouette rather than the vendor's numbering.
 *
 * These were chosen by eye from the `--audit` build, not from filenames — the
 * vendor's suffix letters are not variants of one tree. Families 09/12/13 (and
 * the 01/02 sets) are bare dead branches, and `Rocks_Stoolids`/`Rocks_Bowl` are
 * metre-wide terrain platforms in terrain green, not pebbles. All read as
 * plausible names and all look wrong in the diorama.
 */
const SELECTION = [
  // Trees: full-canopy shapes that still read as a tree at diorama zoom.
  ['trees', 'EA02_Env_Tree_06a', 'tree-round-a'],
  ['trees', 'EA02_Env_Tree_06b', 'tree-round-b'],
  ['trees', 'EA02_Env_Tree_06c', 'tree-small'],
  ['trees', 'EA02_Env_Tree_04a', 'tree-broad'],
  ['trees', 'EA02_Env_Tree_05a', 'tree-golden'],
  ['trees', 'EA02_Env_Tree_05d', 'tree-wide'],
  ['trees', 'EA02_Env_Tree_03b', 'tree-leafy'],
  // The one conifer silhouette in the pack — keeps the ring from reading as a
  // row of identical lollipops now that the rest are round canopies.
  ['trees', 'EA02_Env_Tree_07a', 'tree-conifer'],
  // Understory.
  ['trees', 'EA02_Env_Grass_Mane_01a', 'grass-tuft-a'],
  ['trees', 'EA02_Env_Grass_Mane_01b', 'grass-tuft-b'],
  // Rocks: shoreline scatter, low tri-count, grey faceted boulders.
  ['rocks', 'EA01_Env_Rock_01a', 'rock-round-a'],
  ['rocks', 'EA01_Env_Rock_01b', 'rock-round-b'],
  ['rocks', 'EA01_Env_Rock_01c', 'rock-round-c'],
  ['rocks', 'EA01_Env_Rock_01d', 'rock-round-d'],
  ['rocks', 'EA03_PL_Rock_Flat_01a', 'rock-flat-a'],
  ['rocks', 'EA03_PL_Rock_Flat_01b', 'rock-flat-b'],
  ['rocks', 'EA01_Env_Stone_Cobble_06', 'rock-cobble'],
];

/** Extra UV sets are Unity lightmap channels; the web build has no use for them. */
const DROP_ATTRIBUTES = ['TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3'];

/**
 * `--audit` packs EVERY prop in both source packs (~200) instead of SELECTION,
 * writing to public/models/nature-props-audit.glb. That file is for looking at
 * the candidates in the dev build (see NaturePropLibrary's dev hook) before
 * committing to a subset — it is far too large to ship and is gitignored.
 */
const AUDIT = process.argv.includes('--audit');

function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`not a GLB: ${path}`);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
  // BIN chunk header sits immediately after the JSON chunk's 8-byte header + payload.
  const binStart = 20 + jsonLength;
  let bin = Buffer.alloc(0);
  if (binStart + 8 <= buf.length) {
    const binLength = buf.readUInt32LE(binStart);
    bin = buf.subarray(binStart + 8, binStart + 8 + binLength);
  }
  return { json, bin };
}

function pad4(n) {
  return (4 - (n % 4)) % 4;
}

class GlbBuilder {
  constructor() {
    this.accessors = [];
    this.bufferViews = [];
    this.meshes = [];
    this.nodes = [];
    this.materials = [];
    this.textures = [];
    this.images = [];
    this.samplers = [];
    this.chunks = [];
    this.byteLength = 0;
  }

  /** Appends bytes to the single output buffer, 4-byte aligned, returns its offset. */
  pushBytes(bytes) {
    const padding = pad4(this.byteLength);
    if (padding) {
      this.chunks.push(Buffer.alloc(padding));
      this.byteLength += padding;
    }
    const offset = this.byteLength;
    this.chunks.push(bytes);
    this.byteLength += bytes.length;
    return offset;
  }

  /** Registers a palette atlas as an embedded image + NEAREST-sampled texture. */
  addAtlas(pngBytes) {
    const offset = this.pushBytes(pngBytes);
    const viewIndex = this.bufferViews.length;
    this.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: pngBytes.length });
    const imageIndex = this.images.length;
    this.images.push({ bufferView: viewIndex, mimeType: 'image/png' });
    if (this.samplers.length === 0) {
      // 9728 = NEAREST. A 32px palette must not be filtered.
      this.samplers.push({ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 });
    }
    const textureIndex = this.textures.length;
    this.textures.push({ sampler: 0, source: imageIndex });
    const materialIndex = this.materials.length;
    this.materials.push({
      name: `palette-${materialIndex}`,
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorTexture: { index: textureIndex },
        metallicFactor: 0,
        roughnessFactor: 0.85,
      },
    });
    return materialIndex;
  }

  /**
   * Copies one source prop in, remapping every buffer view / accessor / mesh /
   * node index into this builder's space and forcing the shared atlas material.
   * Returns the index of a wrapper node named `propName`.
   */
  addProp(source, propName, materialIndex) {
    const { json, bin } = source;

    const viewMap = new Map();
    (json.bufferViews ?? []).forEach((view, i) => {
      const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
      const offset = this.pushBytes(Buffer.from(bytes));
      viewMap.set(i, this.bufferViews.length);
      this.bufferViews.push({
        buffer: 0,
        byteOffset: offset,
        byteLength: view.byteLength,
        ...(view.byteStride !== undefined ? { byteStride: view.byteStride } : {}),
        ...(view.target !== undefined ? { target: view.target } : {}),
      });
    });

    const accessorMap = new Map();
    (json.accessors ?? []).forEach((accessor, i) => {
      accessorMap.set(i, this.accessors.length);
      this.accessors.push({
        ...accessor,
        ...(accessor.bufferView !== undefined ? { bufferView: viewMap.get(accessor.bufferView) } : {}),
      });
    });

    const meshMap = new Map();
    (json.meshes ?? []).forEach((mesh, i) => {
      const primitives = mesh.primitives.map((primitive) => {
        const attributes = {};
        for (const [name, accessor] of Object.entries(primitive.attributes)) {
          if (DROP_ATTRIBUTES.includes(name)) continue;
          attributes[name] = accessorMap.get(accessor);
        }
        return {
          attributes,
          ...(primitive.indices !== undefined ? { indices: accessorMap.get(primitive.indices) } : {}),
          material: materialIndex,
          ...(primitive.mode !== undefined ? { mode: primitive.mode } : {}),
        };
      });
      meshMap.set(i, this.meshes.length);
      this.meshes.push({ name: mesh.name, primitives });
    });

    // Copy the node hierarchy verbatim so any baked TRS (Blender's Y-up
    // conversion lands here) survives, then parent its roots to a wrapper.
    const nodeBase = this.nodes.length;
    const sourceNodes = json.nodes ?? [];
    sourceNodes.forEach((node) => {
      this.nodes.push({
        ...(node.name ? { name: node.name } : {}),
        ...(node.mesh !== undefined ? { mesh: meshMap.get(node.mesh) } : {}),
        ...(node.translation ? { translation: node.translation } : {}),
        ...(node.rotation ? { rotation: node.rotation } : {}),
        ...(node.scale ? { scale: node.scale } : {}),
        ...(node.matrix ? { matrix: node.matrix } : {}),
        ...(node.children ? { children: node.children.map((c) => nodeBase + c) } : {}),
      });
    });

    const sceneRoots = (json.scenes?.[json.scene ?? 0]?.nodes ?? sourceNodes.map((_, i) => i)).map(
      (i) => nodeBase + i,
    );
    const wrapperIndex = this.nodes.length;
    this.nodes.push({ name: propName, children: sceneRoots });
    return wrapperIndex;
  }

  write(path, rootNodes) {
    const json = {
      asset: { version: '2.0', generator: 'fish-and-chat pack-nature-props' },
      scene: 0,
      scenes: [{ nodes: rootNodes }],
      nodes: this.nodes,
      meshes: this.meshes,
      accessors: this.accessors,
      bufferViews: this.bufferViews,
      materials: this.materials,
      textures: this.textures,
      images: this.images,
      samplers: this.samplers,
      buffers: [{ byteLength: this.byteLength }],
    };

    const binPadding = pad4(this.byteLength);
    const bin = Buffer.concat([...this.chunks, Buffer.alloc(binPadding)]);
    json.buffers[0].byteLength = bin.length;

    let jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
    if (pad4(jsonBytes.length)) {
      jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(pad4(jsonBytes.length), 0x20)]);
    }

    const header = Buffer.alloc(12);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + bin.length, 8);

    const jsonHeader = Buffer.alloc(8);
    jsonHeader.writeUInt32LE(jsonBytes.length, 0);
    jsonHeader.writeUInt32LE(0x4e4f534a, 4);

    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(bin.length, 0);
    binHeader.writeUInt32LE(0x004e4942, 4);

    writeFileSync(path, Buffer.concat([header, jsonHeader, jsonBytes, binHeader, bin]));
  }
}

function main() {
  for (const pack of Object.values(PACKS)) {
    if (!existsSync(pack.zip)) {
      console.error(`Source archive missing: ${pack.zip}\nMount the assets volume and re-run.`);
      process.exit(1);
    }
  }

  const work = mkdtempSync(join(tmpdir(), 'nature-props-'));
  try {
    const builder = new GlbBuilder();
    const materialByPack = {};

    for (const [key, pack] of Object.entries(PACKS)) {
      const dest = join(work, key);
      execFileSync('unzip', ['-oq', pack.zip, '-d', dest]);
      execFileSync('unzip', ['-oq', pack.texZip, '-d', dest]);
      materialByPack[key] = builder.addAtlas(readFileSync(join(dest, pack.atlas)));
    }

    const selection = AUDIT
      ? Object.entries(PACKS).flatMap(([key, pack]) =>
          readdirSync(join(work, key, pack.dir))
            .filter((f) => f.endsWith('.glb'))
            .map((f) => [key, f.replace(/\.glb$/, ''), f.replace(/\.glb$/, '')]),
        )
      : SELECTION;

    const rootNodes = [];
    const packed = [];
    for (const [packKey, sourceName, propName] of selection) {
      const file = join(work, packKey, PACKS[packKey].dir, `${sourceName}.glb`);
      if (!existsSync(file)) {
        console.error(`  ! missing source prop, skipped: ${packKey}/${sourceName}`);
        continue;
      }
      const source = readGlb(file);
      rootNodes.push(builder.addProp(source, propName, materialByPack[packKey]));
      packed.push(propName);
    }

    const outPath = AUDIT ? OUT_AUDIT_GLB : OUT_GLB;
    builder.write(outPath, rootNodes);

    const triangles = builder.meshes
      .flatMap((mesh) => mesh.primitives)
      .reduce((sum, primitive) => {
        const accessor = builder.accessors[primitive.indices ?? primitive.attributes.POSITION];
        return sum + accessor.count / 3;
      }, 0);
    const kb = (readFileSync(outPath).length / 1024).toFixed(1);
    console.log(`Wrote ${outPath}`);
    console.log(`  ${packed.length} props · ${Math.round(triangles)} triangles · ${builder.materials.length} materials · ${kb} KB`);
    console.log(`  ${packed.join(', ')}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main();
