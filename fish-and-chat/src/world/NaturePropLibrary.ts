import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Loads the packed nature-prop GLB (curated trees/rocks/grass from the itch.io
 * EmaceArt low-poly packs — see scripts/pack-nature-props.mjs for what's in it
 * and where it came from) and hands out sync clones for DioramaBuilder.
 *
 * DioramaBuilder is synchronous and runs on every theme switch, so the pack has
 * to be resident before it can be used: Game preloads it once, then asks the
 * ThemeManager to rebuild. Until that lands — or if the fetch fails, or the
 * `?props=voxel` flag is set — every lookup returns null and the caller falls
 * back to the procedural VoxelKit prop it has always built.
 */

export const TREE_PROPS = [
  'tree-round-a',
  'tree-round-b',
  'tree-small',
  'tree-broad',
  'tree-golden',
  'tree-wide',
  'tree-leafy',
  'tree-conifer',
] as const;

export const GRASS_PROPS = ['grass-tuft-a', 'grass-tuft-b'] as const;

export const ROCK_PROPS = [
  'rock-round-a',
  'rock-round-b',
  'rock-round-c',
  'rock-round-d',
  'rock-flat-a',
  'rock-flat-b',
  'rock-cobble',
] as const;

export type NaturePropId =
  | (typeof TREE_PROPS)[number]
  | (typeof GRASS_PROPS)[number]
  | (typeof ROCK_PROPS)[number];

const PACK_URL = './models/nature-props.glb';

interface Prototype {
  object: THREE.Object3D;
  bounds: THREE.Box3;
}

let prototypes: Map<string, Prototype> | null = null;
let loadPromise: Promise<boolean> | null = null;

/**
 * `?props=voxel` forces the original procedural props so the two prop sets can
 * be compared side by side in the same build. Read once — the flag is not meant
 * to change mid-session.
 */
const forcedMode = new URLSearchParams(window.location.search).get('props');
const IMPORTED_PROPS_DISABLED = forcedMode === 'voxel';

/** True once the pack is resident and the flag hasn't disabled it. */
export function naturePropsReady(): boolean {
  return prototypes !== null && !IMPORTED_PROPS_DISABLED;
}

/**
 * Fetches and indexes the pack. Resolves false (rather than rejecting) when the
 * pack is unavailable — a missing prop file should cost visual richness, never
 * a broken scene.
 */
export function preloadNatureProps(): Promise<boolean> {
  if (IMPORTED_PROPS_DISABLED) return Promise.resolve(false);
  if (loadPromise) return loadPromise;

  loadPromise = new GLTFLoader()
    .loadAsync(PACK_URL)
    .then((gltf) => {
      const indexed = new Map<string, Prototype>();
      // Each curated prop is a named top-level node in the pack.
      for (const child of gltf.scene.children) {
        child.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          // Geometry and material are shared by every clone of this prop, so
          // ThemeManager's per-rebuild disposal must skip them.
          mesh.userData.sharedPrototype = true;
        });
        indexed.set(child.name, { object: child, bounds: new THREE.Box3().setFromObject(child) });
      }
      prototypes = indexed;
      return true;
    })
    .catch((error) => {
      console.warn('[NaturePropLibrary] pack unavailable, falling back to voxel props', error);
      return false;
    });

  return loadPromise;
}

/**
 * How `targetSize` is interpreted. Trees are read by their height, so scaling
 * on Y is right for them. Rocks and grass are often much wider than they are
 * tall (`rock-bowl-a` is 7x wider than tall) — fitting those to a height turns
 * a pebble into a boulder-sized pancake, so they scale by their largest axis.
 */
export type PropFit = 'height' | 'largest-axis';

/**
 * Returns a clone of `id` scaled to `targetSize` along the axis chosen by `fit`
 * and seated on y=0, or null when the pack isn't available. Geometries and
 * materials are shared with the prototype — see the sharedPrototype tag above.
 */
export function spawnNatureProp(
  id: NaturePropId,
  targetSize: number,
  fit: PropFit = 'height',
): THREE.Group | null {
  const prototype = prototypes?.get(id);
  if (!prototype || IMPORTED_PROPS_DISABLED) return null;

  const size = new THREE.Vector3();
  prototype.bounds.getSize(size);
  const center = new THREE.Vector3();
  prototype.bounds.getCenter(center);
  const reference = fit === 'height' ? size.y : Math.max(size.x, size.y, size.z);

  const inner = prototype.object.clone(true);
  // Recenter horizontally and drop the base to the wrapper's origin, so callers
  // position props by their footprint rather than the exporter's pivot.
  inner.position.set(-center.x, -prototype.bounds.min.y, -center.z);
  // The clone inherits the prototype's node name; leaving it would put two
  // objects called `id` on every spawn and make getObjectByName ambiguous.
  inner.name = `${id}-model`;

  const wrapper = new THREE.Group();
  wrapper.scale.setScalar(reference > 0 ? targetSize / reference : 1);
  wrapper.add(inner);

  // The scale wrapper would otherwise also scale the caller's placement; give
  // them an unscaled outer group to position and rotate.
  const outer = new THREE.Group();
  outer.name = id;
  outer.add(wrapper);
  return outer;
}

/** Picks a prop id at random from one of the exported family lists. */
export function pickNatureProp<T extends readonly NaturePropId[]>(family: T): T[number] {
  return family[Math.floor(Math.random() * family.length)];
}

/**
 * Dev-only curation aid. `scripts/pack-nature-props.mjs --audit` packs all ~200
 * source props into nature-props-audit.glb; loading that here and laying it out
 * in a grid is how the shipped SELECTION gets chosen by eye instead of by
 * filename. Mirrors the existing `__game_scene` debug hook in Game.ts.
 */
if (import.meta.env.DEV) {
  (window as unknown as { __nature_props?: unknown }).__nature_props = {
    ids: () => [...(prototypes?.keys() ?? [])],
    spawn: (id: string, size: number, fit: PropFit = 'height') =>
      spawnNatureProp(id as NaturePropId, size, fit),
    /** Replaces the resident pack with the audit build (dev server only). */
    loadAudit: async () => {
      const gltf = await new GLTFLoader().loadAsync('./models/nature-props-audit.glb');
      const indexed = new Map<string, Prototype>();
      for (const child of gltf.scene.children) {
        indexed.set(child.name, { object: child, bounds: new THREE.Box3().setFromObject(child) });
      }
      prototypes = indexed;
      return indexed.size;
    },
  };
}
