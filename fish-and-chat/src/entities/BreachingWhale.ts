import * as THREE from 'three';

interface SplashDroplet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

interface SplashRipple {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  initialScale: number;
  targetScale: number;
}

export interface BreachingWhaleOptions {
  waterY?: number;
  onBreach?: (position: THREE.Vector3) => void;
  emitRipple?: (x: number, z: number) => void;
}

/**
 * 3D low-poly / voxel humpback whale model (body, tail flukes, pectoral fins).
 * Inactive by default underwater/invisible in the distance.
 * When triggered via `triggerBreach(targetPos?)`, it emerges from the water in a graceful arc,
 * leaps high into the air, arcs over with an organic barrel roll, and dives back under
 * the water with a spectacular splash.
 */
export class BreachingWhale {
  readonly group = new THREE.Group();
  private readonly whaleMesh = new THREE.Group();
  private readonly tailGroup = new THREE.Group();
  private readonly leftPectoral = new THREE.Group();
  private readonly rightPectoral = new THREE.Group();

  private readonly splashRoot = new THREE.Group();
  private readonly droplets: SplashDroplet[] = [];
  private readonly ripples: SplashRipple[] = [];

  private readonly materialsToDispose: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];

  private readonly waterY: number;
  private breachCallback?: (position: THREE.Vector3) => void;
  private rippleEmitter?: (x: number, z: number) => void;

  private breaching = false;
  private progress = 0;
  private readonly duration = 3.4; // seconds for complete arc

  private startPos = new THREE.Vector3();
  private apexPos = new THREE.Vector3();
  private endPos = new THREE.Vector3();
  private currentPos = new THREE.Vector3();
  private prevPos = new THREE.Vector3();

  private emerged = false;
  private submerged = false;

  constructor(options: BreachingWhaleOptions = {}) {
    this.waterY = options.waterY ?? -0.05;
    this.breachCallback = options.onBreach;
    this.rippleEmitter = options.emitRipple;

    this.group.name = 'BreachingWhale';
    this.group.visible = false;

    this.group.add(this.whaleMesh);
    this.group.add(this.splashRoot);

    this.buildWhaleModel();
  }

  private buildWhaleModel(): void {
    const skinMat = this.createStandardMaterial('#1e293b', 0.8, 0.1); // dark charcoal/slate
    const bellyMat = this.createStandardMaterial('#cbd5e1', 0.9, 0.05); // pale belly pleats
    const finWhiteMat = this.createStandardMaterial('#f1f5f9', 0.9, 0.05); // pectoral fin white tips
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#090d16' });
    this.materialsToDispose.push(eyeMat);

    // 1. Mid Torso
    const midGeo = new THREE.BoxGeometry(0.85, 0.72, 1.6);
    this.geometriesToDispose.push(midGeo);
    const mid = new THREE.Mesh(midGeo, skinMat);
    mid.position.set(0, 0, 0);
    this.whaleMesh.add(mid);

    // 2. Throat Grooves / Underbelly Pleats
    const bellyGeo = new THREE.BoxGeometry(0.76, 0.14, 1.5);
    this.geometriesToDispose.push(bellyGeo);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, -0.32, 0);
    this.whaleMesh.add(belly);

    // 3. Head / Rostrum (tapered snout with humpback tubercles)
    const headGeo = new THREE.BoxGeometry(0.78, 0.58, 1.1);
    this.geometriesToDispose.push(headGeo);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, -0.04, 1.25);
    this.whaleMesh.add(head);

    // Lower jaw
    const jawGeo = new THREE.BoxGeometry(0.72, 0.22, 1.15);
    this.geometriesToDispose.push(jawGeo);
    const jaw = new THREE.Mesh(jawGeo, bellyMat);
    jaw.position.set(0, -0.28, 1.25);
    this.whaleMesh.add(jaw);

    // Rostrum tubercles (humpback snout knobs)
    const knobGeo = new THREE.SphereGeometry(0.045, 5, 5);
    this.geometriesToDispose.push(knobGeo);
    for (const offset of [
      [0, 0.28, 1.6],
      [-0.18, 0.27, 1.4],
      [0.18, 0.27, 1.4],
      [-0.24, 0.26, 1.1],
      [0.24, 0.26, 1.1],
    ]) {
      const knob = new THREE.Mesh(knobGeo, skinMat);
      knob.position.set(offset[0], offset[1], offset[2]);
      this.whaleMesh.add(knob);
    }

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.04, 0.06, 0.06);
    this.geometriesToDispose.push(eyeGeo);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.41, 0.05, 0.85);
    this.whaleMesh.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.41, 0.05, 0.85);
    this.whaleMesh.add(rightEye);

    // 4. Dorsal Fin
    const dorsalGeo = new THREE.BoxGeometry(0.08, 0.26, 0.35);
    this.geometriesToDispose.push(dorsalGeo);
    const dorsal = new THREE.Mesh(dorsalGeo, skinMat);
    dorsal.position.set(0, 0.44, -0.3);
    dorsal.rotation.x = -0.25; // swept back
    this.whaleMesh.add(dorsal);

    // 5. Long Pectoral Flippers
    // Left Flipper
    this.leftPectoral.position.set(-0.45, -0.05, 0.2);
    const finGeo = new THREE.BoxGeometry(0.12, 0.05, 1.25);
    this.geometriesToDispose.push(finGeo);
    const leftFin = new THREE.Mesh(finGeo, skinMat);
    leftFin.position.set(-0.55, 0, -0.25);
    leftFin.rotation.y = 0.42; // angled outward and back
    this.leftPectoral.add(leftFin);

    // White tip/scalloped edge
    const tipGeo = new THREE.BoxGeometry(0.13, 0.045, 0.35);
    this.geometriesToDispose.push(tipGeo);
    const leftTip = new THREE.Mesh(tipGeo, finWhiteMat);
    leftTip.position.set(-0.85, 0, -0.7);
    leftTip.rotation.y = 0.42;
    this.leftPectoral.add(leftTip);
    this.whaleMesh.add(this.leftPectoral);

    // Right Flipper
    this.rightPectoral.position.set(0.45, -0.05, 0.2);
    const rightFin = new THREE.Mesh(finGeo, skinMat);
    rightFin.position.set(0.55, 0, -0.25);
    rightFin.rotation.y = -0.42;
    this.rightPectoral.add(rightFin);

    const rightTip = new THREE.Mesh(tipGeo, finWhiteMat);
    rightTip.position.set(0.85, 0, -0.7);
    rightTip.rotation.y = -0.42;
    this.rightPectoral.add(rightTip);
    this.whaleMesh.add(this.rightPectoral);

    // 6. Tail Peduncle & Flukes (Articulated Group)
    this.tailGroup.position.set(0, 0, -0.8);

    const peduncleGeo = new THREE.BoxGeometry(0.5, 0.44, 1.1);
    this.geometriesToDispose.push(peduncleGeo);
    const peduncle = new THREE.Mesh(peduncleGeo, skinMat);
    peduncle.position.set(0, 0, -0.55);
    this.tailGroup.add(peduncle);

    // Broad horizontal tail flukes
    const flukeGeo = new THREE.BoxGeometry(1.5, 0.06, 0.45);
    this.geometriesToDispose.push(flukeGeo);
    const flukes = new THREE.Mesh(flukeGeo, skinMat);
    flukes.position.set(0, 0, -1.15);
    this.tailGroup.add(flukes);

    // Fluke trailing edge white notches
    const flukeWhiteGeo = new THREE.BoxGeometry(1.3, 0.04, 0.12);
    this.geometriesToDispose.push(flukeWhiteGeo);
    const flukeWhite = new THREE.Mesh(flukeWhiteGeo, finWhiteMat);
    flukeWhite.position.set(0, -0.015, -1.3);
    this.tailGroup.add(flukeWhite);

    this.whaleMesh.add(this.tailGroup);
  }

  private createStandardMaterial(color: string, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    this.materialsToDispose.push(mat);
    return mat;
  }

  setBreachCallback(callback: (position: THREE.Vector3) => void): void {
    this.breachCallback = callback;
  }

  setRippleEmitter(emitter: (x: number, z: number) => void): void {
    this.rippleEmitter = emitter;
  }

  isBreaching(): boolean {
    return this.breaching;
  }

  /**
   * Triggers a breach jump arc.
   * @param targetPos Optional landing/center position for the breach.
   */
  triggerBreach(targetPos?: THREE.Vector3): void {
    if (this.breaching) return;

    const center = targetPos?.clone() ?? new THREE.Vector3(
      (Math.random() - 0.5) * 5.0,
      this.waterY,
      -7.5 - Math.random() * 1.5,
    );

    // Leap travels horizontally along X while arching high into the sky
    const travelDir = Math.random() > 0.5 ? 1 : -1;
    const horizontalDistance = 3.2;
    const peakHeight = 2.7 + Math.random() * 0.5;

    this.startPos.set(center.x - travelDir * horizontalDistance * 0.5, this.waterY - 1.8, center.z);
    this.apexPos.set(center.x, this.waterY + peakHeight, center.z);
    this.endPos.set(center.x + travelDir * horizontalDistance * 0.5, this.waterY - 1.8, center.z);

    this.currentPos.copy(this.startPos);
    this.prevPos.copy(this.startPos);
    this.whaleMesh.position.copy(this.startPos);

    this.breaching = true;
    this.progress = 0;
    this.emerged = false;
    this.submerged = false;
    this.group.visible = true;

    if (this.breachCallback) {
      this.breachCallback(center);
    }
  }

  update(delta: number): void {
    // Always update any lingering splash particles even when whale has submerged
    this.updateParticles(delta);

    if (!this.breaching) return;

    this.progress += delta / this.duration;

    if (this.progress >= 1.0) {
      this.breaching = false;
      this.group.visible = this.droplets.length > 0 || this.ripples.length > 0;
      return;
    }

    const t = this.progress;
    this.prevPos.copy(this.currentPos);

    // Parabolic breach arc: p(t)
    // Horizontal: smooth lerp
    this.currentPos.x = THREE.MathUtils.lerp(this.startPos.x, this.endPos.x, t);
    this.currentPos.z = THREE.MathUtils.lerp(this.startPos.z, this.endPos.z, t);

    // Height: parabola peaking at t=0.5
    // y(t) = y0 + 4 * (yApex - y0) * t * (1 - t)
    const baseSubmerged = this.startPos.y;
    const archH = 4.0 * t * (1.0 - t);
    this.currentPos.y = baseSubmerged + (this.apexPos.y - baseSubmerged) * archH;

    this.whaleMesh.position.copy(this.currentPos);

    // Orientation / Rotations along breach trajectory:
    // Velocity vector direction
    const travelDir = Math.sign(this.endPos.x - this.startPos.x) || 1;
    const dy = this.currentPos.y - this.prevPos.y;
    const dx = this.currentPos.x - this.prevPos.x;

    // Pitch: points steep up on ascent, level at peak, steep down on descent
    const pitch = Math.atan2(dy, Math.abs(dx)) * 0.9;
    this.whaleMesh.rotation.z = travelDir > 0 ? pitch : -pitch;
    this.whaleMesh.rotation.y = travelDir > 0 ? Math.PI / 2 : -Math.PI / 2;

    // Humpback barrel roll during peak: exposes white belly toward camera (+Z)
    const roll = Math.sin(t * Math.PI) * 0.85;
    this.whaleMesh.rotation.x = roll;

    // Articulated tail flapping / flexion
    this.tailGroup.rotation.x = Math.sin(t * Math.PI * 3.5) * 0.45;
    this.leftPectoral.rotation.z = Math.sin(t * Math.PI * 2.0) * 0.2;
    this.rightPectoral.rotation.z = -Math.sin(t * Math.PI * 2.0) * 0.2;

    // Water surface boundary detection:
    // 1. Emergence splash when breaching out of the water
    if (!this.emerged && this.currentPos.y >= this.waterY) {
      this.emerged = true;
      this.spawnSplashSpray(this.currentPos.x, this.currentPos.z, 28, 1.2);
      this.rippleEmitter?.(this.currentPos.x, this.currentPos.z);
    }

    // 2. Re-entry splash when crashing back into the water
    if (this.emerged && !this.submerged && t > 0.55 && this.currentPos.y <= this.waterY) {
      this.submerged = true;
      // Massive splash on re-entry!
      this.spawnSplashSpray(this.currentPos.x, this.currentPos.z, 46, 2.2);
      this.rippleEmitter?.(this.currentPos.x, this.currentPos.z);
    }
  }

  private spawnSplashSpray(worldX: number, worldZ: number, count: number, force: number): void {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    this.geometriesToDispose.push(geo);

    const mat = new THREE.MeshBasicMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.materialsToDispose.push(mat);

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(worldX + (Math.random() - 0.5) * 0.5, this.waterY + 0.05, worldZ + (Math.random() - 0.5) * 0.5);
      this.splashRoot.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = (0.8 + Math.random() * 1.8) * force;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        (1.5 + Math.random() * 2.5) * force,
        Math.sin(angle) * speed,
      );

      this.droplets.push({
        mesh,
        velocity,
        life: 0.85 + Math.random() * 0.35,
        maxLife: 1.2,
        gravity: 8.5,
      });
    }

    // Expanding foam ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.45, 24);
    this.geometriesToDispose.push(ringGeo);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#dbeafe',
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.materialsToDispose.push(ringMat);

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(worldX, this.waterY + 0.01, worldZ);
    this.splashRoot.add(ring);

    this.ripples.push({
      mesh: ring,
      life: 1.6,
      maxLife: 1.6,
      initialScale: 0.8,
      targetScale: 3.5,
    });
  }

  private updateParticles(delta: number): void {
    // Update Droplets
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i];
      d.life -= delta;
      if (d.life <= 0) {
        this.splashRoot.remove(d.mesh);
        this.droplets.splice(i, 1);
        continue;
      }

      d.velocity.y -= d.gravity * delta;
      d.mesh.position.addScaledVector(d.velocity, delta);

      // Hit water
      if (d.mesh.position.y <= this.waterY && d.velocity.y < 0) {
        this.splashRoot.remove(d.mesh);
        this.droplets.splice(i, 1);
        continue;
      }

      const t = d.life / d.maxLife;
      d.mesh.scale.setScalar(0.4 + t * 0.6);
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = t * 0.85;
    }

    // Update Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.life -= delta;
      if (r.life <= 0) {
        this.splashRoot.remove(r.mesh);
        this.ripples.splice(i, 1);
        continue;
      }

      const t = 1 - r.life / r.maxLife;
      const scale = THREE.MathUtils.lerp(r.initialScale, r.targetScale, t);
      r.mesh.scale.setScalar(scale);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.7;
    }
  }

  dispose(): void {
    for (const d of this.droplets) {
      this.splashRoot.remove(d.mesh);
    }
    this.droplets.length = 0;

    for (const r of this.ripples) {
      this.splashRoot.remove(r.mesh);
    }
    this.ripples.length = 0;

    for (const geo of this.geometriesToDispose) {
      geo.dispose();
    }
    this.geometriesToDispose.length = 0;

    for (const mat of this.materialsToDispose) {
      mat.dispose();
    }
    this.materialsToDispose.length = 0;

    this.group.remove(this.whaleMesh);
    this.group.remove(this.splashRoot);
  }
}
