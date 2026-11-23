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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

interface CachedPartTemplate {
  baseGeometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  restPos: Float32Array;
  restNorm: Float32Array;
  activeVertices: Uint32Array;
  bone0: Uint8Array;
  bone1: Uint8Array;
  weight0: Float32Array;
  weight1: Float32Array;
}

interface CachedRigTemplate {
  parts: CachedPartTemplate[];
  shoulderTopY: number;
  rightShoulder: THREE.Vector3;
  leftShoulder: THREE.Vector3;
  rightElbowPos: THREE.Vector3;
  leftElbowPos: THREE.Vector3;
  rightPalmGripWorld: THREE.Vector3;
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

  const sourceMeshes: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }> = [];
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
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    sourceMeshes.push({ geometry: geom, material: mesh.material });
  });

  const rightArmPts: THREE.Vector3[] = [];
  const leftArmPts: THREE.Vector3[] = [];
  const outerArmYs: number[] = [];
  for (const { geometry } of sourceMeshes) {
    const pos = geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y > 0.30 && y < 0.73) {
        if (Math.abs(x) > 0.135) outerArmYs.push(y);
        if (x < -0.145) rightArmPts.push(new THREE.Vector3(x, y, z));
        else if (x > 0.145) leftArmPts.push(new THREE.Vector3(x, y, z));
      }
    }
  }

  outerArmYs.sort((a, b) => a - b);
  const maxArmY = outerArmYs.length > 10 ? outerArmYs[Math.floor(outerArmYs.length * 0.95)] : 0.62;
  const shoulderY = maxArmY - 0.025;
  const shoulderTopY = maxArmY + 0.035;

  const rightShoulder = new THREE.Vector3(-0.112, shoulderY, 0.0);
  const leftShoulder = new THREE.Vector3(0.112, shoulderY, 0.0);

  const computeHandCentroid = (pts: THREE.Vector3[], shoulder: THREE.Vector3, fallback: THREE.Vector3): THREE.Vector3 => {
    if (pts.length < 12) return fallback;
    const sorted = [...pts].sort((a, b) => b.distanceToSquared(shoulder) - a.distanceToSquared(shoulder));
    const take = Math.max(8, Math.floor(sorted.length * 0.22));
    const sum = new THREE.Vector3();
    for (let i = 0; i < take; i++) sum.add(sorted[i]);
    return sum.divideScalar(take);
  };

  const rightHandPos = computeHandCentroid(rightArmPts, rightShoulder, new THREE.Vector3(-0.222, 0.405, 0.008));
  const leftHandPos = computeHandCentroid(leftArmPts, leftShoulder, new THREE.Vector3(0.222, 0.405, 0.008));

  const rightElbowPos = new THREE.Vector3().lerpVectors(rightShoulder, rightHandPos, 0.48);
  const leftElbowPos = new THREE.Vector3().lerpVectors(leftShoulder, leftHandPos, 0.48);

  const rightArmVec = new THREE.Vector3().subVectors(rightHandPos, rightShoulder);
  const rightArmLen = Math.max(0.08, rightArmVec.length());
  const rightArmDir = rightArmVec.clone().divideScalar(rightArmLen);

  const leftArmVec = new THREE.Vector3().subVectors(leftHandPos, leftShoulder);
  const leftArmLen = Math.max(0.08, leftArmVec.length());
  const leftArmDir = leftArmVec.clone().divideScalar(leftArmLen);

  const rightPalmGripWorld = new THREE.Vector3().lerpVectors(rightShoulder, rightHandPos, 0.86);

  const parts: CachedPartTemplate[] = [];
  const tmpVec = new THREE.Vector3();
  const projVec = new THREE.Vector3();

  for (let idx = 0; idx < sourceMeshes.length; idx++) {
    const { geometry, material } = sourceMeshes[idx];
    const pos = geometry.getAttribute('position');
    const count = pos.count;

    const bone0 = new Uint8Array(count);
    const bone1 = new Uint8Array(count);
    const weight0 = new Float32Array(count);
    const weight1 = new Float32Array(count);
    const activeList: number[] = [];

    for (let i = 0; i < count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      let armW = 0;
      let isRight = false;
      let tArm = 0;

      if (y > 0.31 && y < shoulderTopY && Math.abs(x) > 0.098) {
        isRight = x < 0;
        const shoulder = isRight ? rightShoulder : leftShoulder;
        const armDir = isRight ? rightArmDir : leftArmDir;
        const armLen = isRight ? rightArmLen : leftArmLen;

        tmpVec.set(x, y, z).sub(shoulder);
        const along = tmpVec.dot(armDir);
        tArm = along / armLen;
        projVec.copy(armDir).multiplyScalar(along);
        const perpDist = tmpVec.sub(projVec).length();

        const torsoEdge = 0.104 + Math.max(0, y - (shoulderY - 0.08)) * 0.11;
        const clearance = Math.abs(x) - torsoEdge;

        if (tArm > -0.08 && tArm < 1.25 && perpDist < 0.085 && clearance > 0) {
          const wClear = smoothstep(0.0, 0.036, clearance);
          const wTop = 1 - smoothstep(shoulderTopY - 0.04, shoulderTopY, y);
          armW = wClear * wTop;
        }
      }

      if (isRight && armW > 0.85 && tArm > 0.80) {
        const curlT = smoothstep(0.80, 1.04, tArm);
        const dx = x - rightPalmGripWorld.x;
        const dy = y - rightPalmGripWorld.y;
        const dz = z - rightPalmGripWorld.z;
        x = rightPalmGripWorld.x + dx * (1 - 0.55 * curlT) + 0.014 * curlT;
        y = rightPalmGripWorld.y + dy * (1 - 0.52 * curlT) + 0.008 * curlT;
        z = rightPalmGripWorld.z + dz + 0.018 * Math.sin(curlT * Math.PI);
        pos.setXYZ(i, x, y, z);
      }

      if (armW > 0.001) {
        const upperBone = isRight ? 5 : 3;
        const foreBone = isRight ? 6 : 4;
        const foreRatio = smoothstep(0.24, 0.72, tArm);
        if (armW < 0.999) {
          bone0[i] = upperBone;
          weight0[i] = armW;
          bone1[i] = 1;
          weight1[i] = 1 - armW;
        } else {
          bone0[i] = foreBone;
          weight0[i] = foreRatio;
          bone1[i] = upperBone;
          weight1[i] = 1 - foreRatio;
        }
        activeList.push(i);
      } else if (y >= shoulderTopY - 0.03) {
        const wHead = smoothstep(shoulderTopY - 0.03, shoulderTopY + 0.02, y);
        bone0[i] = 2;
        weight0[i] = wHead;
        bone1[i] = 1;
        weight1[i] = 1 - wHead;
        activeList.push(i);
      } else {
        const wSpine = smoothstep(0.36, 0.45, y);
        bone0[i] = 0;
        weight0[i] = 1 - wSpine;
        bone1[i] = 1;
        weight1[i] = wSpine;
        if (wSpine > 0.001) {
          activeList.push(i);
        }
      }
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    const norm = geometry.getAttribute('normal');

    const restPos = new Float32Array(count * 3);
    const restNorm = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      restPos[i * 3] = pos.getX(i);
      restPos[i * 3 + 1] = pos.getY(i);
      restPos[i * 3 + 2] = pos.getZ(i);
      restNorm[i * 3] = norm.getX(i);
      restNorm[i * 3 + 1] = norm.getY(i);
      restNorm[i * 3 + 2] = norm.getZ(i);
    }

    parts.push({
      baseGeometry: geometry,
      material,
      restPos,
      restNorm,
      activeVertices: new Uint32Array(activeList),
      bone0,
      bone1,
      weight0,
      weight1,
    });
  }

  const template: CachedRigTemplate = {
    parts,
    shoulderTopY,
    rightShoulder,
    leftShoulder,
    rightElbowPos,
    leftElbowPos,
    rightPalmGripWorld,
  };
  rigTemplateCache.set(asset, template);
  return template;
}

/**
 * Instantiates an articulated 7-bone rig from a cached template so subsequent instances
 * (like the Closet preview character) share precomputed weights and rest buffers.
 */
export function buildClayAnglerRig(asset: ImportedAsset, targetHeight = 0.98): ClayAnglerRig {
  const tpl = getOrBuildRigTemplate(asset, targetHeight);
  const root = new THREE.Group();
  root.name = 'ClayAnglerRigRoot';

  const pelvisBone = new THREE.Bone();
  pelvisBone.name = 'pelvisBone';
  pelvisBone.position.set(0, 0, 0);

  const spinePivot = new THREE.Vector3(0, 0.42, 0);
  const spineBone = new THREE.Bone();
  spineBone.name = 'spineBone';
  spineBone.position.copy(spinePivot);
  pelvisBone.add(spineBone);

  const headPivot = new THREE.Vector3(0, tpl.shoulderTopY, 0);
  const headBone = new THREE.Bone();
  headBone.name = 'headBone';
  headBone.position.subVectors(headPivot, spinePivot);
  spineBone.add(headBone);

  const leftUpperArmBone = new THREE.Bone();
  leftUpperArmBone.name = 'leftUpperArmBone';
  leftUpperArmBone.position.subVectors(tpl.leftShoulder, spinePivot);
  spineBone.add(leftUpperArmBone);

  const leftForearmBone = new THREE.Bone();
  leftForearmBone.name = 'leftForearmBone';
  leftForearmBone.position.subVectors(tpl.leftElbowPos, tpl.leftShoulder);
  leftUpperArmBone.add(leftForearmBone);

  const rightUpperArmBone = new THREE.Bone();
  rightUpperArmBone.name = 'rightUpperArmBone';
  rightUpperArmBone.position.subVectors(tpl.rightShoulder, spinePivot);
  spineBone.add(rightUpperArmBone);

  const rightForearmBone = new THREE.Bone();
  rightForearmBone.name = 'rightForearmBone';
  rightForearmBone.position.subVectors(tpl.rightElbowPos, tpl.rightShoulder);
  rightUpperArmBone.add(rightForearmBone);

  const bones: THREE.Bone[] = [
    pelvisBone,
    spineBone,
    headBone,
    leftUpperArmBone,
    leftForearmBone,
    rightUpperArmBone,
    rightForearmBone,
  ];

  root.add(pelvisBone);
  root.updateMatrixWorld(true);
  const rootWorldInv = root.matrixWorld.clone().invert();
  const bindInverses = bones.map((b) => new THREE.Matrix4().multiplyMatrices(rootWorldInv, b.matrixWorld).invert());

  const instanceGeometries: THREE.BufferGeometry[] = [];
  for (let idx = 0; idx < tpl.parts.length; idx++) {
    const part = tpl.parts[idx];
    const geom = part.baseGeometry.clone();
    instanceGeometries.push(geom);
    const mesh = new THREE.Mesh(geom, part.material);
    mesh.name = `ClayAnglerMesh_${idx}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  const headSocket = new THREE.Group();
  headSocket.name = 'claySocketHead';
  headSocket.position.set(0, 0.67 - headPivot.y, -0.01);
  headSocket.scale.setScalar(0.027);
  headBone.add(headSocket);

  const rightHandSocket = new THREE.Group();
  rightHandSocket.name = 'clayAnglerRodPivot';
  rightHandSocket.position.subVectors(tpl.rightPalmGripWorld, tpl.rightElbowPos);

  const gripClaspMat = new THREE.MeshLambertMaterial({ color: '#e2b996' });
  const gripClasp = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 8), gripClaspMat);
  gripClasp.rotation.x = Math.PI / 2;
  gripClasp.position.set(0.004, 0, 0.004);
  rightHandSocket.add(gripClasp);

  rightForearmBone.add(rightHandSocket);

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

  const skinMats = new Float32Array(bones.length * 16);
  const workMat = new THREE.Matrix4();
  const localRootInv = new THREE.Matrix4();
  let lastPoseSignature = '';

  const applyPose = (poseKey: string): void => {
    if (poseKey === lastPoseSignature) return;
    lastPoseSignature = poseKey;

    root.updateMatrixWorld(true);
    localRootInv.copy(root.matrixWorld).invert();
    for (let b = 0; b < bones.length; b++) {
      workMat.multiplyMatrices(localRootInv, bones[b].matrixWorld).multiply(bindInverses[b]);
      skinMats.set(workMat.elements, b * 16);
    }

    for (let idx = 0; idx < tpl.parts.length; idx++) {
      const part = tpl.parts[idx];
      const geom = instanceGeometries[idx];
      const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
      const normAttr = geom.getAttribute('normal') as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const normArr = normAttr.array as Float32Array;
      const { restPos, restNorm, activeVertices, bone0, bone1, weight0, weight1 } = part;

      for (let k = 0; k < activeVertices.length; k++) {
        const i = activeVertices[k];
        const i3 = i * 3;
        const rx = restPos[i3];
        const ry = restPos[i3 + 1];
        const rz = restPos[i3 + 2];
        const nx = restNorm[i3];
        const ny = restNorm[i3 + 1];
        const nz = restNorm[i3 + 2];

        const b0 = bone0[i] * 16;
        const w0 = weight0[i];
        const b1 = bone1[i] * 16;
        const w1 = weight1[i];

        let px = (skinMats[b0] * rx + skinMats[b0 + 4] * ry + skinMats[b0 + 8] * rz + skinMats[b0 + 12]) * w0;
        let py = (skinMats[b0 + 1] * rx + skinMats[b0 + 5] * ry + skinMats[b0 + 9] * rz + skinMats[b0 + 13]) * w0;
        let pz = (skinMats[b0 + 2] * rx + skinMats[b0 + 6] * ry + skinMats[b0 + 10] * rz + skinMats[b0 + 14]) * w0;

        let onx = (skinMats[b0] * nx + skinMats[b0 + 4] * ny + skinMats[b0 + 8] * nz) * w0;
        let ony = (skinMats[b0 + 1] * nx + skinMats[b0 + 5] * ny + skinMats[b0 + 9] * nz) * w0;
        let onz = (skinMats[b0 + 2] * nx + skinMats[b0 + 6] * ny + skinMats[b0 + 10] * nz) * w0;

        if (w1 > 0.0005) {
          px += (skinMats[b1] * rx + skinMats[b1 + 4] * ry + skinMats[b1 + 8] * rz + skinMats[b1 + 12]) * w1;
          py += (skinMats[b1 + 1] * rx + skinMats[b1 + 5] * ry + skinMats[b1 + 9] * rz + skinMats[b1 + 13]) * w1;
          pz += (skinMats[b1 + 2] * rx + skinMats[b1 + 6] * ry + skinMats[b1 + 10] * rz + skinMats[b1 + 14]) * w1;

          onx += (skinMats[b1] * nx + skinMats[b1 + 4] * ny + skinMats[b1 + 8] * nz) * w1;
          ony += (skinMats[b1 + 1] * nx + skinMats[b1 + 5] * ny + skinMats[b1 + 9] * nz) * w1;
          onz += (skinMats[b1 + 2] * nx + skinMats[b1 + 6] * ny + skinMats[b1 + 10] * nz) * w1;
        }

        posArr[i3] = px;
        posArr[i3 + 1] = py;
        posArr[i3 + 2] = pz;
        normArr[i3] = onx;
        normArr[i3 + 1] = ony;
        normArr[i3 + 2] = onz;
      }

      posAttr.needsUpdate = true;
      normAttr.needsUpdate = true;
    }
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
