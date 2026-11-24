import * as THREE from 'three';
import type { ImportedAsset } from '../../assets/ImportedAssetRegistry';

export interface ClayAnglerRig {
  root: THREE.Group;
  pelvisBone: THREE.Bone;
  spineBone: THREE.Bone;
  headBone: THREE.Bone;
  leftUpperArmBone: THREE.Bone;
  leftForearmBone: THREE.Bone;
  rightUpperArmBone: THREE.Bone;
  rightForearmBone: THREE.Bone;
  headSocket: THREE.Group;
  rightHandSocket: THREE.Group;
  contactShadow: THREE.Mesh;
  applyPose: (poseKey: string) => void;
}

interface CachedPartTemplate {
  baseGeometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

interface CachedRigTemplate {
  parts: CachedPartTemplate[];
  fistPos: THREE.Vector3;
  headCenter: THREE.Vector3;
}

const rigTemplateCache = new WeakMap<ImportedAsset, CachedRigTemplate>();

function getOrBuildRigTemplate(asset: ImportedAsset, targetHeight: number): CachedRigTemplate {
  const cached = rigTemplateCache.get(asset);
  if (cached) return cached;

  const size = new THREE.Vector3();
  asset.bounds.getSize(size);
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  const center = new THREE.Vector3();
  asset.bounds.getCenter(center);
  const minY = asset.bounds.min.y;

  const parts: CachedPartTemplate[] = [];
  const waistPts: THREE.Vector3[] = [];
  const headPts: THREE.Vector3[] = [];

  asset.root.updateMatrixWorld(true);
  const rootInv = asset.root.matrixWorld.clone().invert();

  asset.root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geom = mesh.geometry.clone();
    const relMatrix = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
    geom.applyMatrix4(relMatrix);

    const pos = geom.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const nx = (pos.getX(i) - center.x) * scale;
      const ny = (pos.getY(i) - minY) * scale;
      const nz = (pos.getZ(i) - center.z) * scale;
      pos.setXYZ(i, nx, ny, nz);

      if (ny >= 0.40 * targetHeight && ny <= 0.65 * targetHeight) {
        waistPts.push(new THREE.Vector3(nx, ny, nz));
      } else if (ny >= 0.85 * targetHeight) {
        headPts.push(new THREE.Vector3(nx, ny, nz));
      }
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    parts.push({ baseGeometry: geom, material: mesh.material });
  });

  // Locate the sculpted closed fist (forward-most cluster at waist height)
  let fistPos = new THREE.Vector3(0.12, 0.56 * targetHeight, 0.13);
  if (waistPts.length >= 20) {
    waistPts.sort((a, b) => b.z - a.z);
    const take = Math.max(16, Math.floor(waistPts.length * 0.025));
    const sum = new THREE.Vector3();
    for (let i = 0; i < take; i++) sum.add(waistPts[i]);
    fistPos = sum.divideScalar(take);
    // Nudge slightly inward toward the palm center so the cork handle passes cleanly through the fist
    fistPos.z -= 0.014;
  }

  let headCenter = new THREE.Vector3(0, 0.96 * targetHeight, 0);
  if (headPts.length >= 10) {
    const sum = new THREE.Vector3();
    for (const p of headPts) sum.add(p);
    sum.divideScalar(headPts.length);
    headCenter = new THREE.Vector3(sum.x, 0.96 * targetHeight, sum.z);
  }

  const template: CachedRigTemplate = { parts, fistPos, headCenter };
  rigTemplateCache.set(asset, template);
  return template;
}

/**
 * Instantiates a natural-stance clay figurine rig with grounded boots,
 * head hat-socket, and a hand socket centered inside the sculpted closed fist.
 */
export function buildClayAnglerRig(asset: ImportedAsset, targetHeight = 0.98): ClayAnglerRig {
  const tpl = getOrBuildRigTemplate(asset, targetHeight);
  const root = new THREE.Group();
  root.name = 'ClayAnglerRigRoot';

  const pelvisBone = new THREE.Bone();
  pelvisBone.name = 'pelvisBone';
  const spineBone = new THREE.Bone();
  spineBone.name = 'spineBone';
  const headBone = new THREE.Bone();
  headBone.name = 'headBone';
  const leftUpperArmBone = new THREE.Bone();
  const leftForearmBone = new THREE.Bone();
  const rightUpperArmBone = new THREE.Bone();
  const rightForearmBone = new THREE.Bone();
  pelvisBone.add(spineBone);
  spineBone.add(headBone);
  spineBone.add(leftUpperArmBone);
  leftUpperArmBone.add(leftForearmBone);
  spineBone.add(rightUpperArmBone);
  rightUpperArmBone.add(rightForearmBone);
  root.add(pelvisBone);

  for (let idx = 0; idx < tpl.parts.length; idx++) {
    const part = tpl.parts[idx];
    const mesh = new THREE.Mesh(part.baseGeometry, part.material);
    mesh.name = `ClayAnglerMesh_${idx}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  const headSocket = new THREE.Group();
  headSocket.name = 'claySocketHead';
  headSocket.position.set(tpl.headCenter.x, tpl.headCenter.y - 0.25, tpl.headCenter.z);
  headSocket.scale.setScalar(0.027);
  root.add(headSocket);

  const rightHandSocket = new THREE.Group();
  rightHandSocket.name = 'clayAnglerRodPivot';
  rightHandSocket.position.copy(tpl.fistPos);
  root.add(rightHandSocket);

  const shadowMat = new THREE.MeshBasicMaterial({
    color: '#26170b',
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(new THREE.CircleGeometry(0.145, 16), shadowMat);
  contactShadow.name = 'anglerContactShadow';
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.scale.set(1.05, 0.78, 1);
  contactShadow.position.set(0, 0.004, 0.01);
  root.add(contactShadow);

  const applyPose = (_poseKey: string): void => {
    // Natural-stance meshes already hold their relaxed arm and fist pose;
    // rod and body motion are driven cleanly via Object3D transforms.
  };

  return {
    root,
    pelvisBone,
    spineBone,
    headBone,
    leftUpperArmBone,
    leftForearmBone,
    rightUpperArmBone,
    rightForearmBone,
    headSocket,
    rightHandSocket,
    contactShadow,
    applyPose,
  };
}
