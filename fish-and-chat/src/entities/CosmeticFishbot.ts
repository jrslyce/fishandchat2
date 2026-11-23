import * as THREE from 'three';
import { MODEL_SOURCE_MANIFEST_PUBLIC } from '../assets/manifest';
import { loadImportedAsset, normalizedClone } from '../assets/ImportedAssetRegistry';

const BASE_POSITION = new THREE.Vector3(-0.25, 0.78, 0.24);

/** Dock-side hovering ceramic/clay companion drone and its optional Starlight finish. */
export class CosmeticFishbot {
  readonly group = new THREE.Group();
  private readonly fallbackGroup = new THREE.Group();
  private readonly shell = new THREE.MeshStandardMaterial({ color: '#f3efe4', roughness: 0.65, metalness: 0.08 });
  private readonly trim = new THREE.MeshStandardMaterial({ color: '#c89b49', roughness: 0.35, metalness: 0.65 });
  private readonly stars: THREE.Mesh[] = [];
  private glbModel: THREE.Group | null = null;
  private glbMaterials: Array<THREE.MeshLambertMaterial | THREE.MeshStandardMaterial> = [];
  private baseColors: THREE.Color[] = [];
  private hasBot = false;
  private starlight = false;
  private disposed = false;
  private time = 0;

  constructor() {
    this.group.name = 'cosmeticFishbot';
    this.group.position.copy(BASE_POSITION);
    this.group.rotation.y = Math.PI * 0.88;

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), this.shell);
    body.castShadow = true;
    body.position.y = 0.15;
    this.fallbackGroup.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), new THREE.MeshStandardMaterial({ color: '#ef9e35', roughness: 0.25 }));
    eye.position.set(0, 0.15, 0.13);
    this.fallbackGroup.add(eye);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.14, 6), this.trim);
    antenna.position.set(0, 0.34, 0);
    this.fallbackGroup.add(antenna);
    this.group.add(this.fallbackGroup);

    const starMat = new THREE.MeshBasicMaterial({ color: '#b7ecff' });
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), starMat);
      star.visible = false;
      this.group.add(star);
      this.stars.push(star);
    }
    this.group.visible = false;

    void this.loadModel();
  }

  private async loadModel(): Promise<void> {
    try {
      const asset = await loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.fishbot);
      if (this.disposed) return;

      const model = normalizedClone(asset, 0.30);
      model.name = 'FishbotImportedGLB';
      model.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const clonedMats = mats.map((mat) => {
          const clone = mat.clone() as THREE.MeshLambertMaterial | THREE.MeshStandardMaterial;
          this.glbMaterials.push(clone);
          this.baseColors.push(clone.color ? clone.color.clone() : new THREE.Color('#ffffff'));
          return clone;
        });
        mesh.material = Array.isArray(mesh.material) ? clonedMats : clonedMats[0];
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.userData.sharedAssetGeometry = true;
      });

      this.glbModel = model;
      this.fallbackGroup.visible = false;
      this.group.add(model);
      this.applyAppearance();
    } catch {
      // Keep ceramic fallback sphere if GLB fails to load.
    }
  }

  setAppearance(hasBot: boolean, starlight: boolean): void {
    this.hasBot = hasBot;
    this.starlight = starlight;
    this.applyAppearance();
  }

  private applyAppearance(): void {
    this.group.visible = this.hasBot;
    this.shell.color.set(this.starlight ? '#3d338c' : '#f3efe4');
    this.shell.emissive.set(this.starlight ? '#2d2a81' : '#000000');
    this.trim.color.set(this.starlight ? '#c8a7ff' : '#c89b49');
    if (this.glbModel) {
      this.glbMaterials.forEach((mat, idx) => {
        const base = this.baseColors[idx];
        if (this.starlight) {
          mat.color.copy(base).lerp(new THREE.Color('#6f58c8'), 0.55);
          mat.emissive.set('#2b2575');
          mat.emissiveIntensity = 0.45;
        } else {
          mat.color.copy(base);
          mat.emissive.set('#000000');
          mat.emissiveIntensity = 0;
        }
      });
    }
    for (const star of this.stars) star.visible = this.starlight;
  }

  update(delta: number): void {
    if (!this.group.visible) return;
    this.time += delta;
    this.group.position.y = BASE_POSITION.y + 0.032 * Math.sin(this.time * 2.1);
    this.group.rotation.y = Math.PI * 0.88 + Math.sin(this.time * 1.1) * 0.14;
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      const angle = this.time * 0.9 + (i * Math.PI * 2) / this.stars.length;
      star.position.set(Math.cos(angle) * 0.25, 0.22 + 0.08 * Math.sin(this.time * 2 + i), Math.sin(angle) * 0.25);
      star.rotation.y = angle;
    }
  }

  dispose(): void {
    this.disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.userData.sharedAssetGeometry) geometries.add(mesh.geometry);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of mats) materials.add(material);
    });
    for (const mat of this.glbMaterials) materials.add(mat);
    geometries.forEach((geo) => geo.dispose());
    materials.forEach((mat) => mat.dispose());
  }
}
