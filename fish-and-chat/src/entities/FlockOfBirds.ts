import * as THREE from 'three';

interface BirdInstance {
  root: THREE.Group;
  leftWingPivot: THREE.Group;
  rightWingPivot: THREE.Group;
  offset: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  velocity: THREE.Vector3;
  flapPhase: number;
}

export interface FlockOfBirdsOptions {
  birdCount?: number;
  center?: THREE.Vector3;
  flightSpeed?: number;
}

/**
 * A group of 3-5 3D low-poly seagulls/birds.
 * Each bird has a stylized body and two articulated wings that flap sinusoidally.
 * Flies in smooth natural curves or circles across the sky, banking into turns and
 * occasionally swooping down towards the water before climbing back into the clouds.
 */
export class FlockOfBirds {
  readonly group = new THREE.Group();
  private readonly birds: BirdInstance[] = [];

  private readonly materialsToDispose: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];

  private flightTime = 0;
  private readonly flightSpeed: number;
  private readonly center: THREE.Vector3;

  // Swooping state machine
  private swoopTimer = 18; // interval between swoops
  private isSwooping = false;
  private swoopProgress = 0;
  private readonly swoopDuration = 4.2;

  private readonly leaderPos = new THREE.Vector3();
  private readonly prevLeaderPos = new THREE.Vector3();
  private readonly leaderVelocity = new THREE.Vector3();

  constructor(options: FlockOfBirdsOptions = {}) {
    const count = THREE.MathUtils.clamp(options.birdCount ?? 4, 3, 5);
    this.flightSpeed = Math.max(0.05, options.flightSpeed ?? 0.55);
    this.center = options.center?.clone() ?? new THREE.Vector3(0, 1.05, -7.2);

    this.leaderPos.set(
      this.center.x,
      this.center.y,
      this.center.z + 1.6,
    );
    this.prevLeaderPos.copy(this.leaderPos);

    this.group.name = 'FlockOfBirds';

    // Formation offsets behind the leader
    const formationOffsets: THREE.Vector3[] = [
      new THREE.Vector3(0, 0, 0),             // 0: Leader
      new THREE.Vector3(-0.85, 0.12, 1.0),    // 1: Left wingman
      new THREE.Vector3(0.85, -0.08, 1.1),    // 2: Right wingman
      new THREE.Vector3(-1.6, 0.22, 2.0),     // 3: Far left
      new THREE.Vector3(1.5, 0.16, 2.1),      // 4: Far right
    ];

    for (let i = 0; i < count; i++) {
      const bird = this.buildBird(formationOffsets[i], i * 0.45);
      this.birds.push(bird);
      this.group.add(bird.root);
    }
  }

  private buildBird(offset: THREE.Vector3, flapPhase: number): BirdInstance {
    const root = new THREE.Group();
    root.name = `Bird_${flapPhase}`;

    const bodyMat = this.createStandardMaterial('#f8fafc', 0.9, 0.05); // white feathers
    const wingMat = this.createStandardMaterial('#f1f5f9', 0.85, 0.05); // light grey wings
    const wingTipMat = this.createStandardMaterial('#334155', 0.8, 0.1); // dark charcoal tips
    const beakMat = this.createStandardMaterial('#f59e0b', 0.7, 0.1); // orange beak
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
    this.materialsToDispose.push(eyeMat);

    // 1. Fuselage / Torso
    const torsoGeo = new THREE.BoxGeometry(0.13, 0.11, 0.38);
    this.geometriesToDispose.push(torsoGeo);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    root.add(torso);

    // 2. Head & Beak
    const headGeo = new THREE.BoxGeometry(0.09, 0.09, 0.14);
    this.geometriesToDispose.push(headGeo);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 0.04, 0.24);
    root.add(head);

    const beakGeo = new THREE.BoxGeometry(0.04, 0.035, 0.12);
    this.geometriesToDispose.push(beakGeo);
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.position.set(0, 0.03, 0.36);
    root.add(beak);

    // Tiny eyes
    const eyeGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
    this.geometriesToDispose.push(eyeGeo);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.05, 0.05, 0.24);
    root.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.05, 0.05, 0.24);
    root.add(rightEye);

    // 3. Tail Feathers
    const tailGeo = new THREE.BoxGeometry(0.12, 0.02, 0.16);
    this.geometriesToDispose.push(tailGeo);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.position.set(0, 0.02, -0.25);
    tail.rotation.x = 0.12;
    root.add(tail);

    // 4. Articulated Left Wing
    const leftWingPivot = new THREE.Group();
    leftWingPivot.position.set(-0.07, 0.03, 0.02);

    const wingGeo = new THREE.BoxGeometry(0.42, 0.02, 0.14);
    this.geometriesToDispose.push(wingGeo);
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-0.21, 0, -0.02);
    leftWing.rotation.y = 0.12; // swept back slightly
    leftWingPivot.add(leftWing);

    // Left Wing Dark Tip
    const tipGeo = new THREE.BoxGeometry(0.14, 0.022, 0.12);
    this.geometriesToDispose.push(tipGeo);
    const leftTip = new THREE.Mesh(tipGeo, wingTipMat);
    leftTip.position.set(-0.48, 0, -0.05);
    leftTip.rotation.y = 0.12;
    leftWingPivot.add(leftTip);

    root.add(leftWingPivot);

    // 5. Articulated Right Wing
    const rightWingPivot = new THREE.Group();
    rightWingPivot.position.set(0.07, 0.03, 0.02);

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0.21, 0, -0.02);
    rightWing.rotation.y = -0.12;
    rightWingPivot.add(rightWing);

    const rightTip = new THREE.Mesh(tipGeo, wingTipMat);
    rightTip.position.set(0.48, 0, -0.05);
    rightTip.rotation.y = -0.12;
    rightWingPivot.add(rightTip);

    root.add(rightWingPivot);

    const currentPos = new THREE.Vector3(offset.x, 3.2 + offset.y, -5.5 + offset.z);
    root.position.copy(currentPos);

    return {
      root,
      leftWingPivot,
      rightWingPivot,
      offset,
      targetPos: currentPos.clone(),
      currentPos,
      velocity: new THREE.Vector3(0, 0, 1),
      flapPhase,
    };
  }

  private createStandardMaterial(color: string, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    this.materialsToDispose.push(mat);
    return mat;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  update(delta: number): void {
    this.flightTime += delta * this.flightSpeed;

    // 1. Swoop trigger timer
    this.swoopTimer -= delta;
    if (!this.isSwooping && this.swoopTimer <= 0) {
      this.isSwooping = true;
      this.swoopProgress = 0;
      this.swoopTimer = 24.0 + Math.random() * 12.0;
    }

    let swoopYOffset = 0;
    let isGliding = false;

    if (this.isSwooping) {
      this.swoopProgress += delta / this.swoopDuration;
      if (this.swoopProgress >= 1.0) {
        this.isSwooping = false;
      } else {
        // Bell curve dip down toward water surface without sinking below it
        const dip = Math.sin(this.swoopProgress * Math.PI);
        swoopYOffset = -dip * 0.9;

        // Glides on way down, flaps briskly on climb
        if (this.swoopProgress < 0.45) {
          isGliding = true;
        }
      }
    }

    // 2. Leader parametric trajectory (wide smooth figure-8 loop inside panel frustum)
    const t = this.flightTime;
    this.prevLeaderPos.copy(this.leaderPos);

    this.leaderPos.x = this.center.x + Math.sin(t * 1.0) * 2.1 + Math.sin(t * 2.2) * 0.45;
    this.leaderPos.z = this.center.z + Math.cos(t * 1.0) * 1.6;
    this.leaderPos.y = this.center.y + Math.sin(t * 1.6) * 0.28 + swoopYOffset;

    this.leaderVelocity.subVectors(this.leaderPos, this.prevLeaderPos);
    if (delta > 0) {
      this.leaderVelocity.divideScalar(delta);
    }

    // Compute heading / forward vector of leader
    const forward = this.leaderVelocity.clone().normalize();
    if (forward.lengthSq() < 0.001) {
      forward.set(0, 0, 1);
    }
    const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    // 3. Update all birds in formation
    const flapSpeed = isGliding ? 1.5 : (this.isSwooping ? 11.0 : 7.2);
    const flapAmp = isGliding ? 0.08 : (this.isSwooping ? 0.62 : 0.48);

    for (let i = 0; i < this.birds.length; i++) {
      const bird = this.birds[i];

      // Target world position from leader position + rotated formation offset
      // offset.z is distance behind, offset.x is distance lateral
      bird.targetPos.copy(this.leaderPos)
        .addScaledVector(right, bird.offset.x)
        .addScaledVector(forward, -bird.offset.z)
        .addScaledVector(up, bird.offset.y);

      // Smooth lerp toward target formation point
      const lerpFactor = i === 0 ? 1.0 : (1.0 - Math.exp(-delta * 4.5));
      bird.currentPos.lerp(bird.targetPos, lerpFactor);
      bird.root.position.copy(bird.currentPos);

      // Look direction: face target position + forward tangent
      const lookTarget = bird.currentPos.clone().add(forward);
      bird.root.lookAt(lookTarget);

      // Banking roll into curves (local Z so lookAt yaw/pitch stays intact)
      const curvature = Math.sin(t * 1.0);
      bird.root.rotateZ(-curvature * 0.45);

      // Wing flapping animation
      const flap = Math.sin((this.flightTime / this.flightSpeed) * flapSpeed + bird.flapPhase) * flapAmp;
      bird.leftWingPivot.rotation.z = flap;
      bird.rightWingPivot.rotation.z = -flap;
    }
  }

  dispose(): void {
    for (const geo of this.geometriesToDispose) {
      geo.dispose();
    }
    this.geometriesToDispose.length = 0;

    for (const mat of this.materialsToDispose) {
      mat.dispose();
    }
    this.materialsToDispose.length = 0;

    for (const bird of this.birds) {
      this.group.remove(bird.root);
    }
    this.birds.length = 0;
  }
}
