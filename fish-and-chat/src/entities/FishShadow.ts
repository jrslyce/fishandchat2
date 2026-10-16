import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose';

export interface FishShadowOptions {
  baseColor?: string;
  baseOpacity?: number;
  baseScale?: number;
}

/**
 * 3D articulated underwater fish shadow/silhouette.
 * Comprises a streamlined torpedo body with head, pectoral fins, dorsal fin,
 * and a 2-segment articulated tail (tail stem + forked caudal fin) that
 * wiggles realistically with swimming speed and flexes into turns.
 */
export class FishShadow {
  readonly group = new THREE.Group();

  private readonly torsoGroup = new THREE.Group();
  private readonly tailStemGroup = new THREE.Group();
  private readonly caudalFinGroup = new THREE.Group();

  private readonly material: THREE.MeshBasicMaterial;
  private readonly finMaterial: THREE.MeshBasicMaterial;

  private baseColor = new THREE.Color('#071a26');
  private baseOpacity = 0.85;
  private baseScale = 0.48;

  private wiggleClock = 0;
  private currentWiggleSpeed = 7.5;
  private currentTurnBias = 0;

  constructor(options: FishShadowOptions = {}) {
    if (options.baseColor) this.baseColor.set(options.baseColor);
    if (options.baseOpacity !== undefined) this.baseOpacity = options.baseOpacity;
    if (options.baseScale !== undefined) this.baseScale = options.baseScale;

    this.group.name = 'fishShadowRoot';
    this.group.renderOrder = 2;

    this.material = new THREE.MeshBasicMaterial({
      color: this.baseColor,
      transparent: true,
      opacity: this.baseOpacity,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });

    this.finMaterial = new THREE.MeshBasicMaterial({
      color: this.baseColor,
      transparent: true,
      opacity: this.baseOpacity * 0.90,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });

    this.buildHierarchy();
    this.group.scale.setScalar(this.baseScale);
    // Keep Y just above the water plane (-0.05) with renderOrder: 2 so it blends cleanly
    this.group.position.y = -0.046;
  }

  private buildHierarchy(): void {
    // 1. Torso: sleek fish body shape in XY, then rotated -PI/2 on X so +Z is forward
    const torsoShape = new THREE.Shape();
    torsoShape.moveTo(0, 0.20); // nose tip (+Z forward)
    torsoShape.quadraticCurveTo(0.048, 0.14, 0.058, 0.08); // right head/gills
    torsoShape.lineTo(0.125, 0.01); // right pectoral fin tip
    torsoShape.lineTo(0.058, -0.03); // right pectoral base
    torsoShape.quadraticCurveTo(0.050, -0.065, 0.026, -0.11); // right flank to tail hinge
    torsoShape.lineTo(-0.026, -0.11); // tail hinge
    torsoShape.quadraticCurveTo(-0.050, -0.065, -0.058, -0.03); // left flank
    torsoShape.lineTo(-0.125, 0.01); // left pectoral fin tip
    torsoShape.lineTo(-0.058, 0.08); // left head/gills
    torsoShape.quadraticCurveTo(-0.048, 0.14, 0, 0.20); // back to nose

    const torsoGeom = new THREE.ExtrudeGeometry(torsoShape, {
      depth: 0.034,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.010,
      bevelThickness: 0.010,
    });
    // Center extrusion thickness around 0, then rotate so Shape Y maps to World +Z
    torsoGeom.translate(0, 0, -0.027);
    torsoGeom.rotateX(-Math.PI / 2);

    const torsoMesh = new THREE.Mesh(torsoGeom, this.material);
    torsoMesh.renderOrder = 2;
    this.torsoGroup.add(torsoMesh);

    // Subtle dorsal fin along top of the spine
    const dorsalGeom = new THREE.BufferGeometry();
    const dorsalVerts = new Float32Array([
      0, 0.018, 0.05,   // front base
      0, 0.048, -0.01,  // peak
      0, 0.015, -0.08,  // rear base
    ]);
    dorsalGeom.setAttribute('position', new THREE.BufferAttribute(dorsalVerts, 3));
    dorsalGeom.computeVertexNormals();
    const dorsalMesh = new THREE.Mesh(dorsalGeom, this.finMaterial);
    dorsalMesh.renderOrder = 2;
    this.torsoGroup.add(dorsalMesh);

    this.group.add(this.torsoGroup);

    // 2. Tail stem joint: attached at the rear of torso (z = -0.11)
    this.tailStemGroup.position.set(0, 0, -0.11);

    const stemShape = new THREE.Shape();
    stemShape.moveTo(0.026, 0); // starts at hinge width
    stemShape.quadraticCurveTo(0.018, -0.05, 0.013, -0.10); // tapers to caudal base
    stemShape.lineTo(-0.013, -0.10);
    stemShape.quadraticCurveTo(-0.018, -0.05, -0.026, 0);
    stemShape.closePath();

    const stemGeom = new THREE.ExtrudeGeometry(stemShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.006,
      bevelThickness: 0.006,
    });
    stemGeom.translate(0, 0, -0.017);
    stemGeom.rotateX(-Math.PI / 2);

    const stemMesh = new THREE.Mesh(stemGeom, this.material);
    stemMesh.renderOrder = 2;
    this.tailStemGroup.add(stemMesh);

    // 3. Forked caudal fin: attached at the rear of tail stem (z = -0.10)
    this.caudalFinGroup.position.set(0, 0, -0.10);

    const finShape = new THREE.Shape();
    finShape.moveTo(0.013, 0); // caudal fin attachment
    finShape.lineTo(0.080, -0.115); // right fin tip
    finShape.quadraticCurveTo(0.038, -0.09, 0, -0.065); // center fork notch
    finShape.quadraticCurveTo(-0.038, -0.09, -0.080, -0.115); // left fin tip
    finShape.lineTo(-0.013, 0);
    finShape.closePath();

    const finGeom = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.004,
      bevelThickness: 0.004,
    });
    finGeom.translate(0, 0, -0.01);
    finGeom.rotateX(-Math.PI / 2);

    const finMesh = new THREE.Mesh(finGeom, this.finMaterial);
    finMesh.renderOrder = 2;
    this.caudalFinGroup.add(finMesh);

    this.tailStemGroup.add(this.caudalFinGroup);
    this.group.add(this.tailStemGroup);
  }

  setThemeColor(waterDeepHex: string): void {
    const col = new THREE.Color(waterDeepHex);
    col.multiplyScalar(0.24);
    this.baseColor.copy(col);
    this.material.color.copy(col);
    this.finMaterial.color.copy(col);
  }

  setBaseScale(scale: number): void {
    this.baseScale = scale;
    this.group.scale.setScalar(scale);
  }

  /**
   * Depth factor 0 (surface, crisp & dark) to 1 (deep underwater, faint & smaller).
   */
  setDepth(depthFactor: number): void {
    const clamped = Math.max(0, Math.min(1, depthFactor));
    this.group.position.y = -0.046;
    // Simulate depth via opacity and subtle scaling
    const opacity = THREE.MathUtils.lerp(this.baseOpacity, 0.42, clamped);
    this.material.opacity = Math.max(0, opacity);
    this.finMaterial.opacity = Math.max(0, opacity * 0.92);
    const scale = this.baseScale * (1 - clamped * 0.16);
    this.group.scale.setScalar(scale);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  isVisible(): boolean {
    return this.group.visible;
  }

  /**
   * Updates tail wiggling, banking, and spine curvature.
   * @param delta Frame time delta in seconds
   * @param speed Current swimming speed in units/sec
   * @param turnRate Current turning rate in rad/sec (positive = right, negative = left)
   */
  update(delta: number, speed: number, turnRate = 0): void {
    if (!this.group.visible) return;

    // Swimming frequency scales with forward speed: idle glide vs rapid sprint
    this.currentWiggleSpeed = 4.8 + Math.max(0, speed) * 6.5;
    this.wiggleClock += delta * this.currentWiggleSpeed;

    // Smooth turn bias
    this.currentTurnBias = THREE.MathUtils.lerp(this.currentTurnBias, turnRate, delta * 8.0);

    // Serpentine wave
    const wiggleAmp = Math.max(0.14, Math.min(0.40, 0.32 - speed * 0.04));
    const waveStem = Math.sin(this.wiggleClock) * wiggleAmp;
    const waveFin = Math.sin(this.wiggleClock - 0.75) * (wiggleAmp * 1.35);

    // Flex into the turn
    this.tailStemGroup.rotation.y = waveStem + this.currentTurnBias * 0.35;
    this.caudalFinGroup.rotation.y = waveFin + this.currentTurnBias * 0.25;

    // Subtle banking/roll when carving curves
    this.group.rotation.z = THREE.MathUtils.lerp(
      this.group.rotation.z,
      -this.currentTurnBias * 0.18,
      delta * 6.0,
    );
  }

  dispose(): void {
    disposeObject3D(this.group);
    this.material.dispose();
    this.finMaterial.dispose();
  }
}
