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

export interface KrakenTentacleOptions {
  waterY?: number;
  onBreach?: (position: THREE.Vector3) => void;
  emitRipple?: (x: number, z: number) => void;
}

/**
 * 3D low-poly / voxel giant sea serpent / kraken tentacle.
 * Starts submerged/hidden underwater on the distant ocean horizon.
 * When `triggerBreach(targetPos?)` is called:
 * - Rises dramatically out of the water in a graceful curved S-shape.
 * - Reaches high above the water, curls its tip, lingers momentarily, slaps the surface with splash spray,
 *   and dives back into the depths.
 * - Surface water ripple and splash particle emitters on breach and submergence.
 * - Emits callback or event `krakenBreach`.
 */
export class KrakenTentacle {
  readonly group = new THREE.Group();
  private readonly tentacleRoot = new THREE.Group();
  private readonly splashRoot = new THREE.Group();

  // Articulated segment chain
  private readonly segmentGroups: THREE.Group[] = [];
  private readonly segmentCount = 8;

  private readonly droplets: SplashDroplet[] = [];
  private readonly ripples: SplashRipple[] = [];

  private readonly materialsToDispose: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];

  private readonly waterY: number;
  private breachCallback?: (position: THREE.Vector3) => void;
  private rippleEmitter?: (x: number, z: number) => void;

  private breaching = false;
  private progress = 0;
  private readonly duration = 4.3; // seconds for complete breach sequence
  private time = 0;

  private centerPos = new THREE.Vector3();

  private breachSplashTriggered = false;
  private slapSplashTriggered = false;
  private submergeSplashTriggered = false;

  constructor(options: KrakenTentacleOptions = {}) {
    this.waterY = options.waterY ?? -0.05;
    this.breachCallback = options.onBreach;
    this.rippleEmitter = options.emitRipple;

    this.group.name = 'KrakenTentacle';
    this.group.visible = false;

    this.group.add(this.tentacleRoot);
    this.group.add(this.splashRoot);

    this.buildTentacleModel();
  }

  private buildTentacleModel(): void {
    // Abyssal deep purple/indigo skin with bioluminescent suction cups
    const skinDarkMat = this.createStandardMaterial('#1e1b4b', 0.85, 0.15); // midnight abyssal indigo
    const skinRidgeMat = this.createStandardMaterial('#312e81', 0.8, 0.2);   // deep violet ridge
    const suckerMat = this.createStandardMaterial('#f472b6', 0.6, 0.1);     // bioluminescent pink/coral
    const suckerRimMat = this.createStandardMaterial('#fbcfe8', 0.7, 0.05);

    // Segment dimension profiles (from base to tip)
    const segmentConfigs = [
      { rBot: 0.52, rTop: 0.46, len: 0.60 }, // 0: Base
      { rBot: 0.46, rTop: 0.40, len: 0.58 }, // 1
      { rBot: 0.40, rTop: 0.35, len: 0.55 }, // 2
      { rBot: 0.35, rTop: 0.30, len: 0.52 }, // 3: Mid
      { rBot: 0.30, rTop: 0.25, len: 0.50 }, // 4
      { rBot: 0.25, rTop: 0.20, len: 0.48 }, // 5
      { rBot: 0.20, rTop: 0.14, len: 0.45 }, // 6: Upper
      { rBot: 0.14, rTop: 0.08, len: 0.42 }, // 7: Tip segment
    ];

    let parentGroup: THREE.Group = this.tentacleRoot;

    for (let i = 0; i < this.segmentCount; i++) {
      const cfg = segmentConfigs[i];
      const segGroup = new THREE.Group();
      segGroup.name = `KrakenSegment_${i}`;

      // 1. Tapered octagonal body
      const bodyGeo = new THREE.CylinderGeometry(cfg.rTop, cfg.rBot, cfg.len, 8);
      this.geometriesToDispose.push(bodyGeo);
      const bodyMesh = new THREE.Mesh(bodyGeo, i % 2 === 0 ? skinDarkMat : skinRidgeMat);
      // Pivot at base of segment: translate mesh up by half length
      bodyMesh.position.set(0, cfg.len * 0.5, 0);
      segGroup.add(bodyMesh);

      // 2. Dorsal spiny ridge / tooth scales (on posterior +Z side)
      const ridgeGeo = new THREE.ConeGeometry(cfg.rTop * 0.45, cfg.len * 0.4, 4);
      this.geometriesToDispose.push(ridgeGeo);
      const ridge = new THREE.Mesh(ridgeGeo, skinRidgeMat);
      ridge.position.set(0, cfg.len * 0.55, cfg.rTop * 1.05);
      ridge.rotation.x = Math.PI * 0.4;
      segGroup.add(ridge);

      // 3. Suction cups on anterior / inner curve side (-Z side)
      // 2 suction cups per segment
      const suckerRadius = cfg.rTop * 0.45;
      const suckerGeo = new THREE.CylinderGeometry(suckerRadius, suckerRadius * 0.85, 0.06, 8);
      this.geometriesToDispose.push(suckerGeo);

      const rimGeo = new THREE.RingGeometry(suckerRadius * 0.5, suckerRadius, 8);
      this.geometriesToDispose.push(rimGeo);

      for (let s = 0; s < 2; s++) {
        const suckerY = cfg.len * (0.28 + s * 0.44);
        const suckerMesh = new THREE.Mesh(suckerGeo, suckerMat);
        suckerMesh.position.set(0, suckerY, -cfg.rTop * 0.98);
        suckerMesh.rotation.x = -Math.PI / 2;
        segGroup.add(suckerMesh);

        const rimMesh = new THREE.Mesh(rimGeo, suckerRimMat);
        rimMesh.position.set(0, suckerY, -cfg.rTop * 1.02);
        segGroup.add(rimMesh);
      }

      // Add to hierarchy: first segment sits in tentacleRoot, others attach to tip of previous segment
      if (i === 0) {
        segGroup.position.set(0, 0, 0);
      } else {
        const prevCfg = segmentConfigs[i - 1];
        segGroup.position.set(0, prevCfg.len, 0);
      }

      parentGroup.add(segGroup);
      this.segmentGroups.push(segGroup);
      parentGroup = segGroup;
    }

    // Terminal tip claw / barb on segment 7
    const tipGeo = new THREE.ConeGeometry(0.08, 0.35, 8);
    this.geometriesToDispose.push(tipGeo);
    const tipMesh = new THREE.Mesh(tipGeo, skinDarkMat);
    const lastCfg = segmentConfigs[this.segmentCount - 1];
    tipMesh.position.set(0, lastCfg.len + 0.175, 0);
    parentGroup.add(tipMesh);
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
   * Triggers the kraken breach animation.
   * @param targetPos Optional center water position for the breach.
   */
  triggerBreach(targetPos?: THREE.Vector3): void {
    if (this.breaching) return;

    // Distant ocean horizon coordinate (e.g. x: -4..4, z: -8..-10)
    this.centerPos = targetPos?.clone() ?? new THREE.Vector3(
      (Math.random() - 0.5) * 6.0,
      this.waterY,
      -8.5 - Math.random() * 2.0,
    );

    this.group.position.copy(this.centerPos);
    this.tentacleRoot.position.set(0, -3.8, 0);
    this.tentacleRoot.rotation.set(0, (Math.random() - 0.5) * 0.8, 0);

    // Reset segment rotations
    for (const seg of this.segmentGroups) {
      seg.rotation.set(0, 0, 0);
    }

    this.breaching = true;
    this.progress = 0;
    this.breachSplashTriggered = false;
    this.slapSplashTriggered = false;
    this.submergeSplashTriggered = false;
    this.group.visible = true;

    this.breachCallback?.(this.centerPos);
  }

  update(delta: number): void {
    this.time += delta;
    this.updateParticles(delta);

    if (!this.breaching) return;

    this.progress += delta / this.duration;

    if (this.progress >= 1.0) {
      this.breaching = false;
      this.tentacleRoot.position.set(0, -5.0, 0);
      this.group.visible = this.droplets.length > 0 || this.ripples.length > 0;
      return;
    }

    const t = this.progress;

    // --- Kinematic Breach Stages ---
    // Total duration: ~4.3s
    // Stage 1: Emergence (t: 0.0 -> 0.28) - Rises gracefully with S-curve formation
    // Stage 2: Towering Reach & Writhing Lingering (t: 0.28 -> 0.65) - High reach, tip curls tightly
    // Stage 3: Violent Surface Slap (t: 0.65 -> 0.82) - Whips down, hits water surface with massive spray
    // Stage 4: Submergence & Dive (t: 0.82 -> 1.0) - Slips back into the ocean depths

    let rootY = -3.8;
    let sCurveWeight = 0;
    let slapWeight = 0;
    let diveWeight = 0;

    if (t < 0.28) {
      // Emergence
      const subT = t / 0.28;
      const easeOut = Math.sin(subT * Math.PI * 0.5);
      rootY = THREE.MathUtils.lerp(-3.8, 0.45, easeOut);
      sCurveWeight = easeOut;
    } else if (t < 0.65) {
      // Towering reach and menacing hover
      const subT = (t - 0.28) / (0.65 - 0.28);
      rootY = 0.45 + Math.sin(subT * Math.PI) * 0.25;
      sCurveWeight = 1.0;
    } else if (t < 0.82) {
      // Slap downward
      const subT = (t - 0.65) / (0.82 - 0.65);
      slapWeight = Math.sin(subT * Math.PI * 0.5);
      rootY = THREE.MathUtils.lerp(0.45, -0.6, slapWeight);
      sCurveWeight = 1.0 - slapWeight * 0.4;
    } else {
      // Submergence into depths
      const subT = (t - 0.82) / (1.0 - 0.82);
      diveWeight = subT;
      rootY = THREE.MathUtils.lerp(-0.6, -4.5, subT * subT);
    }

    this.tentacleRoot.position.y = rootY;

    // Organic S-curve & writhing kinematics across the 8 segments
    const writhePhase = this.time * 3.8;
    for (let i = 0; i < this.segmentCount; i++) {
      const seg = this.segmentGroups[i];

      // S-curve: lower segments bend back/right, middle segments curve forward/left, tip curls tightly
      const baseCurveZ = Math.sin(i * 0.65) * 0.28 * sCurveWeight;
      const baseCurveX = (i < 3 ? -0.16 : 0.28) * sCurveWeight;

      // Writhing sinusoidal ripple
      const writheX = Math.sin(writhePhase + i * 0.7) * 0.06;
      const writheZ = Math.cos(writhePhase * 0.8 + i * 0.6) * 0.05;

      // Tip curling inwards into an ominous coil
      const tipCurl = i >= 4 ? (i - 3) * 0.22 * sCurveWeight : 0;

      // Whip / Slap posture: lower segments lunge forward, tip whips down
      const slapBendX = slapWeight > 0 ? (i < 4 ? -0.35 * slapWeight : 0.48 * slapWeight) : 0;

      // Dive posture: segments align straight down
      const diveStraighten = 1.0 - diveWeight * 0.8;

      seg.rotation.x = (baseCurveX + writheX + tipCurl + slapBendX) * diveStraighten;
      seg.rotation.z = (baseCurveZ + writheZ) * diveStraighten;
      seg.rotation.y = Math.sin(writhePhase * 0.5 + i * 0.4) * 0.04;
    }

    // --- Surface Water Events ---
    // 1. Initial breach splash as tentacle erupts from water
    if (!this.breachSplashTriggered && rootY > -0.8 && t < 0.3) {
      this.breachSplashTriggered = true;
      this.spawnSplashSpray(this.centerPos.x, this.centerPos.z, 32, 1.3);
      this.rippleEmitter?.(this.centerPos.x, this.centerPos.z);
    }

    // 2. Colossal surface slap impact when tip strikes the water
    if (!this.slapSplashTriggered && t >= 0.76 && t <= 0.83) {
      this.slapSplashTriggered = true;
      // Slap strikes in front of base (along local Z curve)
      const slapX = this.centerPos.x + (Math.random() - 0.5) * 0.4;
      const slapZ = this.centerPos.z + 1.4;
      this.spawnSplashSpray(slapX, slapZ, 48, 2.6);
      this.rippleEmitter?.(slapX, slapZ);
    }

    // 3. Submergence churning splash as tentacle slips under
    if (!this.submergeSplashTriggered && t >= 0.90) {
      this.submergeSplashTriggered = true;
      this.spawnSplashSpray(this.centerPos.x, this.centerPos.z, 24, 0.9);
      this.rippleEmitter?.(this.centerPos.x, this.centerPos.z);
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
      mesh.position.set(
        worldX + (Math.random() - 0.5) * 0.6,
        this.waterY + 0.05,
        worldZ + (Math.random() - 0.5) * 0.6,
      );
      this.splashRoot.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = (0.9 + Math.random() * 2.0) * force;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        (1.8 + Math.random() * 2.6) * force,
        Math.sin(angle) * speed,
      );

      this.droplets.push({
        mesh,
        velocity,
        life: 0.9 + Math.random() * 0.4,
        maxLife: 1.3,
        gravity: 8.8,
      });
    }

    // Expanding foam shockwave ring
    const ringGeo = new THREE.RingGeometry(0.35, 0.55, 24);
    this.geometriesToDispose.push(ringGeo);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#dbeafe',
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.materialsToDispose.push(ringMat);

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(worldX, this.waterY + 0.012, worldZ);
    this.splashRoot.add(ring);

    this.ripples.push({
      mesh: ring,
      life: 1.8,
      maxLife: 1.8,
      initialScale: 0.8,
      targetScale: 3.8 * (force > 2.0 ? 1.4 : 1.0),
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
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.75;
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

    this.group.remove(this.tentacleRoot);
    this.group.remove(this.splashRoot);
  }
}
