import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * GLTFLoader picks ImageBitmapLoader over plain ImageLoader whenever `createImageBitmap`
 * exists, to move texture decoding off the main thread. ImageBitmapLoader loads embedded
 * GLB textures via `fetch(blobUrl)`, which falls under the page's CSP `connect-src` — and
 * Twitch's extension CSP has no way to allowlist the `blob:` scheme there (its allowlist
 * fields only accept real domains), so every embedded texture fails to load in a hosted
 * Twitch extension. Forcing the plain ImageLoader path (an `<img>` tag, governed by
 * `img-src`, which already permits `'self'`) sidesteps the restriction entirely.
 */
delete (window as unknown as { createImageBitmap?: unknown }).createImageBitmap;

export interface ImportedAsset {
  root: THREE.Group;
  bounds: THREE.Box3;
  diagnostics: {
    triangles: number;
    materials: number;
    textures: number;
    fileUrl: string;
  };
}

const loader = new GLTFLoader();
const cache = new Map<string, Promise<ImportedAsset>>();

function countTriangles(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    const index = geometry.getIndex();
    if (index) triangles += index.count / 3;
    else triangles += (geometry.getAttribute('position')?.count ?? 0) / 3;
  });
  return Math.round(triangles);
}

function countMaterialsAndTextures(root: THREE.Object3D): { materials: number; textures: number } {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      materials.add(mat);
      for (const value of Object.values(mat as unknown as Record<string, unknown>)) {
        if (value && typeof value === 'object' && (value as THREE.Texture).isTexture) {
          textures.add(value as THREE.Texture);
        }
      }
    }
  });
  return { materials: materials.size, textures: textures.size };
}

/**
 * Loads (and caches) a Tripo-generated GLB, returning a wrapper with bounds
 * and diagnostics rather than the raw gltf.scene — callers should clone the
 * root for each scene instance since materials/geometries are shared.
 */
export async function loadImportedAsset(url: string): Promise<ImportedAsset> {
  const existing = cache.get(url);
  if (existing) return existing;

  const promise = loader.loadAsync(url).then((gltf) => {
    const root = gltf.scene;
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    const bounds = new THREE.Box3().setFromObject(root);
    const { materials, textures } = countMaterialsAndTextures(root);
    return {
      root,
      bounds,
      diagnostics: { triangles: countTriangles(root), materials, textures, fileUrl: url },
    };
  });

  cache.set(url, promise);
  return promise;
}

/** Returns a normalized clone: recentered on its base, scaled to targetHeight. Safe to add multiple times. */
export function normalizedClone(asset: ImportedAsset, targetHeight: number): THREE.Group {
  const clone = new THREE.Group();
  const inner = asset.root.clone(true);
  const size = new THREE.Vector3();
  asset.bounds.getSize(size);
  const scale = size.y > 0 ? targetHeight / size.y : 1;

  const center = new THREE.Vector3();
  asset.bounds.getCenter(center);
  inner.position.set(-center.x, -asset.bounds.min.y, -center.z);

  const scaleWrapper = new THREE.Group();
  scaleWrapper.scale.setScalar(scale);
  scaleWrapper.add(inner);
  clone.add(scaleWrapper);
  return clone;
}
