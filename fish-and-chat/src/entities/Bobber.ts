import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose';
import type { FishingPhase } from '../game/GameState';

interface ThrowState {
  start: THREE.Vector3;
  end: THREE.Vector3;
  duration: number;
  elapsed: number;
}

interface GlitterSparkle {
  mesh: THREE.Mesh;
  baseY: number;
  radius: number;
  orbitSpeed: number;
  orbitAngle: number;
  baseScale: number;
  twinklePhase: number;
  rotSpeedX: number;
  rotSpeedY: number;
}

/**
 * The fishing bobber.
 * Dynamically swaps visual models based on the currently equipped bait:
 * - 'pleb-bait': Classic red-and-white buoy float (GLB model when loaded, procedural fallback).
 * - 'marshmallows': Soft pillowy stacked marshmallows on a bamboo skewer with soft matte finish.
 * - 'nightcrawlers': Fluorescent yellow segmented worm body pierced by a fluorescent orange stick.
 * - 'neon-super-lure': Multi-faceted iridescent futuristic lure with animated orbiting glitter sparkles.
 */
export class Bobber {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly ripple: THREE.Mesh;
  private readonly attachmentAnchor = new THREE.Object3D();

  // Model variants
  private readonly defaultModelGroup = new THREE.Group();
  private fallbackDefaultModel: THREE.Object3D;
  private customGlbModel: THREE.Object3D | null = null;
  private readonly marshmallowModel: THREE.Object3D;
  private readonly nightcrawlerModel: THREE.Object3D;
  private readonly neonLureModel: THREE.Object3D;

  // Glitter & sparkle animations for neon super lure
  private readonly glitterSparkles: GlitterSparkle[] = [];
  private neonCoreMaterial: THREE.MeshStandardMaterial | null = null;
  private glitterClock = 0;

  private currentBaitId = 'pleb-bait';
  private rippleClock = 0;
  private floatClock = 0;
  private biteClock = 0;
  private biteRippleClock = 0;
  private throwState: ThrowState | null = null;

  constructor(private readonly waterY: number) {
    this.group.renderOrder = 3;

    // Water ripple ring
    this.ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.22, 24),
      new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    );
    this.ripple.rotation.x = -Math.PI / 2;
    this.ripple.visible = false;
    this.group.add(this.ripple);

    // Setup body group and line attachment anchor
    this.attachmentAnchor.name = 'bobberAttachmentAnchor';
    this.attachmentAnchor.position.set(0, 0.28, 0);
    this.body.add(this.attachmentAnchor);
    this.group.add(this.body);

    // 1. Fallback & GLB default model for pleb bait
    this.fallbackDefaultModel = this.createFallbackDefaultModel();
    this.defaultModelGroup.add(this.fallbackDefaultModel);
    this.body.add(this.defaultModelGroup);

    // 2. Marshmallows model
    this.marshmallowModel = this.createMarshmallowModel();
    this.marshmallowModel.position.y = 0.115;
    this.marshmallowModel.visible = false;
    this.body.add(this.marshmallowModel);

    // 3. Nightcrawlers model (fluorescent yellow with fluorescent orange stick)
    this.nightcrawlerModel = this.createNightcrawlerModel();
    this.nightcrawlerModel.position.y = 0.090;
    this.nightcrawlerModel.visible = false;
    this.body.add(this.nightcrawlerModel);

    // 4. Neon super lure model (special & glittery)
    this.neonLureModel = this.createNeonSuperLureModel();
    this.neonLureModel.position.y = 0.100;
    this.neonLureModel.visible = false;
    this.body.add(this.neonLureModel);

    this.updateBaitVisibility();
  }

  /**
   * Attaches the loaded GLB root as the pleb bait's 3D float.
   */
  setModel(root: THREE.Object3D): void {
    if (this.customGlbModel) {
      this.defaultModelGroup.remove(this.customGlbModel);
    }
    this.customGlbModel = root;
    this.fallbackDefaultModel.visible = false;
    this.defaultModelGroup.add(root);
    this.updateBaitVisibility();
  }

  /**
   * Switches the active 3D bobber geometry and effects to match the equipped bait.
   */
  setBaitType(baitId: string): void {
    if (this.currentBaitId === baitId) return;
    this.currentBaitId = baitId;
    this.updateBaitVisibility();
  }

  getBaitType(): string {
    return this.currentBaitId;
  }

  getActiveModelName(): string {
    if (this.currentBaitId === 'marshmallows') return 'marshmallowBobber';
    if (this.currentBaitId === 'nightcrawlers') return 'nightcrawlerBobber';
    if (this.currentBaitId === 'neon-super-lure') return 'neonSuperLureBobber';
    return 'defaultBobber';
  }

  private updateBaitVisibility(): void {
    const isPleb = this.currentBaitId === 'pleb-bait';
    const isMarshmallow = this.currentBaitId === 'marshmallows';
    const isNightcrawler = this.currentBaitId === 'nightcrawlers';
    const isNeonLure = this.currentBaitId === 'neon-super-lure';

    this.defaultModelGroup.visible = isPleb;
    if (this.customGlbModel) {
      this.customGlbModel.visible = isPleb;
      this.fallbackDefaultModel.visible = false;
    } else {
      this.fallbackDefaultModel.visible = isPleb;
    }

    this.marshmallowModel.visible = isMarshmallow;
    this.nightcrawlerModel.visible = isNightcrawler;
    this.neonLureModel.visible = isNeonLure;
  }

  /**
   * Creates a procedural fallback for the classic red-and-white bobber.
   */
  private createFallbackDefaultModel(): THREE.Object3D {
    const group = new THREE.Group();
    group.name = 'fallbackDefaultBobber';

    // Top hemisphere: glossy red
    const topGeo = new THREE.SphereGeometry(0.048, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.25, metalness: 0.1 });
    const topMesh = new THREE.Mesh(topGeo, redMat);
    topMesh.position.y = 0.08;
    group.add(topMesh);

    // Bottom hemisphere: glossy white
    const botGeo = new THREE.SphereGeometry(0.048, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.1 });
    const botMesh = new THREE.Mesh(botGeo, whiteMat);
    botMesh.position.y = 0.08;
    group.add(botMesh);

    // Black equator seam
    const seamGeo = new THREE.CylinderGeometry(0.049, 0.049, 0.008, 16);
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const seamMesh = new THREE.Mesh(seamGeo, seamMat);
    seamMesh.position.y = 0.08;
    group.add(seamMesh);

    // Center stem/quill extending to y = 0.22
    const stemGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.22, 10);
    const stemMesh = new THREE.Mesh(stemGeo, redMat);
    stemMesh.position.y = 0.11;
    group.add(stemMesh);

    // White eyelet bead on top
    const beadGeo = new THREE.SphereGeometry(0.008, 8, 8);
    const beadMesh = new THREE.Mesh(beadGeo, whiteMat);
    beadMesh.position.y = 0.218;
    group.add(beadMesh);

    return group;
  }

  /**
   * Creates the marshmallow bobber:
   * A stack of pillowy, velvety marshmallows strung on a bamboo skewer with soft matte finish.
   */
  private createMarshmallowModel(): THREE.Object3D {
    const group = new THREE.Group();
    group.name = 'marshmallowBobber';

    // Materials: ultra-soft powdery matte finish with vivid clean marshmallow colors
    const whiteMarshmallowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.65,
      roughness: 0.8,
      metalness: 0.02,
    });
    const pinkMarshmallowMat = new THREE.MeshStandardMaterial({
      color: 0xffc4d8,
      emissive: 0xff88aa,
      emissiveIntensity: 0.55,
      roughness: 0.8,
      metalness: 0.02,
    });
    const skewerMat = new THREE.MeshStandardMaterial({
      color: 0xdfc194,
      roughness: 0.8,
      metalness: 0.05,
    });
    const beadMat = new THREE.MeshStandardMaterial({
      color: 0xff2255,
      roughness: 0.3,
      metalness: 0.2,
    });

    const mStack = new THREE.Group();
    mStack.rotation.x = -0.32;
    mStack.rotation.y = 0.25;

    // Marshmallow 1 (bottom): fluffy classic white marshmallow cylinder
    const m1Geo = new THREE.CylinderGeometry(0.052, 0.052, 0.070, 24);
    const m1Mesh = new THREE.Mesh(m1Geo, whiteMarshmallowMat);
    m1Mesh.position.set(0, 0.055, 0);
    mStack.add(m1Mesh);

    // Soft rounded bevel rings for bottom marshmallow edges
    const rim1Geo = new THREE.TorusGeometry(0.048, 0.005, 8, 24);
    const topRim1 = new THREE.Mesh(rim1Geo, whiteMarshmallowMat);
    topRim1.rotation.x = Math.PI / 2;
    topRim1.position.set(0, 0.090, 0);
    mStack.add(topRim1);

    const botRim1 = new THREE.Mesh(rim1Geo, whiteMarshmallowMat);
    botRim1.rotation.x = Math.PI / 2;
    botRim1.position.set(0, 0.020, 0);
    mStack.add(botRim1);

    // Marshmallow 2 (top): strawberry-blush marshmallow tilted slightly
    const m2Group = new THREE.Group();
    m2Group.position.set(0.008, 0.135, -0.006);
    m2Group.rotation.set(0.12, 0.25, -0.15);

    const m2Geo = new THREE.CylinderGeometry(0.046, 0.046, 0.065, 24);
    const m2Mesh = new THREE.Mesh(m2Geo, pinkMarshmallowMat);
    m2Group.add(m2Mesh);

    const rim2Geo = new THREE.TorusGeometry(0.042, 0.005, 8, 24);
    const topRim2 = new THREE.Mesh(rim2Geo, pinkMarshmallowMat);
    topRim2.rotation.x = Math.PI / 2;
    topRim2.position.set(0, 0.032, 0);
    m2Group.add(topRim2);

    const botRim2 = new THREE.Mesh(rim2Geo, pinkMarshmallowMat);
    botRim2.rotation.x = Math.PI / 2;
    botRim2.position.set(0, -0.032, 0);
    m2Group.add(botRim2);

    mStack.add(m2Group);

    // Thin bamboo skewer piercing both marshmallows through the center
    const skewerGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.23, 10);
    const skewerMesh = new THREE.Mesh(skewerGeo, skewerMat);
    skewerMesh.position.set(0, 0.115, 0);
    mStack.add(skewerMesh);

    // Cute float bead stopper on top where the line connects
    const stopperGeo = new THREE.SphereGeometry(0.009, 12, 12);
    const stopperMesh = new THREE.Mesh(stopperGeo, beadMat);
    stopperMesh.position.set(0, 0.228, 0);
    mStack.add(stopperMesh);

    group.add(mStack);

    return group;
  }

  /**
   * Creates the nightcrawler bobber:
   * Fluorescent yellow segmented body with a fluorescent orange stick through it.
   */
  private createNightcrawlerModel(): THREE.Object3D {
    const group = new THREE.Group();
    group.name = 'nightcrawlerBobber';

    // Fluorescent yellow material (chartreuse/neon yellow with vivid neon green-yellow emission)
    const neonYellowMat = new THREE.MeshStandardMaterial({
      color: 0xeeff00,
      emissive: 0xaaff00,
      emissiveIntensity: 1.4,
      roughness: 0.35,
      metalness: 0.08,
    });

    // Fluorescent orange material (radiant neon orange stick with high emission)
    const neonOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xff4f00,
      emissive: 0xff3300,
      emissiveIntensity: 1.6,
      roughness: 0.25,
      metalness: 0.15,
    });

    // Segment divider ring material (slightly deeper chartreuse)
    const segmentGrooveMat = new THREE.MeshStandardMaterial({
      color: 0xccdd00,
      emissive: 0x88bb00,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    });

    // 1. Segmented fluorescent yellow worm body (curving arch)
    const wormBodyGroup = new THREE.Group();
    const segmentSpecs = [
      { pos: [-0.042, 0.046, 0.022], scale: [0.030, 0.028, 0.030] }, // head
      { pos: [-0.028, 0.068, 0.014], scale: [0.033, 0.030, 0.033] },
      { pos: [-0.012, 0.088, 0.005], scale: [0.037, 0.033, 0.037] }, // clitellum/swelling
      { pos: [0.006, 0.104, -0.004], scale: [0.035, 0.031, 0.035] }, // pierced center
      { pos: [0.022, 0.108, -0.012], scale: [0.033, 0.029, 0.033] },
      { pos: [0.038, 0.096, -0.007], scale: [0.029, 0.027, 0.029] },
      { pos: [0.048, 0.076, 0.007], scale: [0.025, 0.023, 0.025] },
      { pos: [0.052, 0.052, 0.022], scale: [0.019, 0.018, 0.019] }, // tail
    ];

    const sphereGeo = new THREE.SphereGeometry(1, 14, 12);
    const ringGeo = new THREE.TorusGeometry(1, 0.12, 8, 16);

    for (let i = 0; i < segmentSpecs.length; i++) {
      const spec = segmentSpecs[i];
      const segMesh = new THREE.Mesh(sphereGeo, neonYellowMat);
      segMesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      segMesh.scale.set(spec.scale[0], spec.scale[1], spec.scale[2]);
      wormBodyGroup.add(segMesh);

      // Add segment divider rings between segments
      if (i > 0 && i < segmentSpecs.length - 1) {
        const ringMesh = new THREE.Mesh(ringGeo, segmentGrooveMat);
        ringMesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
        ringMesh.scale.set(spec.scale[0] * 0.98, spec.scale[1] * 0.98, spec.scale[2] * 0.98);
        ringMesh.rotation.set(0.3, 0.2, 0.5);
        wormBodyGroup.add(ringMesh);
      }
    }
    wormBodyGroup.rotation.x = -0.32;
    group.add(wormBodyGroup);

    // 2. Fluorescent orange stick through it!
    // A straight neon orange stick piercing through the center segment (pos: [0.006, 0.104, -0.004])
    const stickGroup = new THREE.Group();
    stickGroup.position.set(0.006, 0.104, -0.004);
    // Angled diagonally so it noticeably protrudes through both sides of the worm
    stickGroup.rotation.set(0.24, 0.15, 0.58);

    const stickGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.21, 12);
    const stickMesh = new THREE.Mesh(stickGeo, neonOrangeMat);
    stickGroup.add(stickMesh);

    // Bright end caps on the protruding stick
    const capGeo = new THREE.SphereGeometry(0.0065, 8, 8);
    const topCap = new THREE.Mesh(capGeo, neonOrangeMat);
    topCap.position.y = 0.105;
    stickGroup.add(topCap);

    const botCap = new THREE.Mesh(capGeo, neonOrangeMat);
    botCap.position.y = -0.105;
    stickGroup.add(botCap);

    group.add(stickGroup);

    // Line attachment connector leading up to (0, 0.22, 0)
    const leaderWireGeo = new THREE.CylinderGeometry(0.0025, 0.0025, 0.12, 8);
    const leaderWireMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.6 });
    const leaderMesh = new THREE.Mesh(leaderWireGeo, leaderWireMat);
    leaderMesh.position.set(0, 0.165, 0);
    group.add(leaderMesh);

    const eyeletGeo = new THREE.TorusGeometry(0.007, 0.0022, 8, 16);
    const eyeletMesh = new THREE.Mesh(eyeletGeo, neonOrangeMat);
    eyeletMesh.position.set(0, 0.218, 0);
    group.add(eyeletMesh);

    return group;
  }

  /**
   * Creates the neon super lure:
   * Something special and glittery!
   * Multi-faceted iridescent crystalline chrome body with twin neon aero-fins, gold trim,
   * glowing pulsing core, and 16 animated orbiting glitter sparkle particles.
   */
  private createNeonSuperLureModel(): THREE.Object3D {
    const group = new THREE.Group();
    group.name = 'neonSuperLureBobber';

    // Prismatic iridescent neon materials
    this.neonCoreMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f3ff,
      emissive: 0x0099ff,
      emissiveIntensity: 1.25,
      metalness: 0.9,
      roughness: 0.12,
    });

    const neonMagentaMat = new THREE.MeshStandardMaterial({
      color: 0xff00bb,
      emissive: 0xee0088,
      emissiveIntensity: 1.2,
      metalness: 0.8,
      roughness: 0.15,
    });

    const goldChromeMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0x886600,
      emissiveIntensity: 0.45,
      metalness: 0.96,
      roughness: 0.08,
    });

    // 1. Faceted upper torpedo hull
    const upperGeo = new THREE.CylinderGeometry(0.016, 0.052, 0.13, 6);
    const upperMesh = new THREE.Mesh(upperGeo, this.neonCoreMaterial);
    upperMesh.position.set(0, 0.12, 0);
    group.add(upperMesh);

    // 2. Inverted faceted tail cone
    const lowerGeo = new THREE.ConeGeometry(0.052, 0.10, 6);
    const lowerMesh = new THREE.Mesh(lowerGeo, this.neonCoreMaterial);
    lowerMesh.rotation.x = Math.PI;
    lowerMesh.position.set(0, 0.038, 0);
    group.add(lowerMesh);

    // 3. Neon magenta aerodynamic stabilizer fins (twin side fins)
    const finGeo = new THREE.BoxGeometry(0.16, 0.045, 0.008);
    const finMesh = new THREE.Mesh(finGeo, neonMagentaMat);
    finMesh.position.set(0, 0.095, 0);
    group.add(finMesh);

    const finGeo2 = new THREE.BoxGeometry(0.008, 0.045, 0.16);
    const finMesh2 = new THREE.Mesh(finGeo2, neonMagentaMat);
    finMesh2.position.set(0, 0.095, 0);
    group.add(finMesh2);

    // 4. Gold nose cone & eyelet collar
    const collarGeo = new THREE.CylinderGeometry(0.010, 0.018, 0.035, 8);
    const collarMesh = new THREE.Mesh(collarGeo, goldChromeMat);
    collarMesh.position.set(0, 0.19, 0);
    group.add(collarMesh);

    // Gold line ring eyelet on top
    const eyeletGeo = new THREE.TorusGeometry(0.011, 0.003, 8, 16);
    const eyeletMesh = new THREE.Mesh(eyeletGeo, goldChromeMat);
    eyeletMesh.position.set(0, 0.22, 0);
    group.add(eyeletMesh);

    // 5. Orbiting glitter sparkle particles!
    const sparklePalette = [
      new THREE.MeshBasicMaterial({ color: 0xffffff }), // diamond white
      new THREE.MeshBasicMaterial({ color: 0x00ffff }), // electric cyan
      new THREE.MeshBasicMaterial({ color: 0xff33ee }), // magenta sparkle
      new THREE.MeshBasicMaterial({ color: 0xffee44 }), // gold glitter
    ];

    const sparkleGeo = new THREE.OctahedronGeometry(0.015, 0);
    this.glitterSparkles.length = 0;

    for (let i = 0; i < 16; i++) {
      const mat = sparklePalette[i % sparklePalette.length];
      const sparkleMesh = new THREE.Mesh(sparkleGeo, mat);

      const radius = 0.065 + (i % 4) * 0.018;
      const baseY = 0.05 + (i / 16) * 0.14;
      const orbitSpeed = 1.8 + (i % 3) * 0.9;
      const orbitAngle = (i / 16) * Math.PI * 2;
      const baseScale = 1.0 + Math.random() * 0.6;

      sparkleMesh.position.set(
        Math.cos(orbitAngle) * radius,
        baseY,
        Math.sin(orbitAngle) * radius,
      );
      sparkleMesh.scale.setScalar(baseScale);

      group.add(sparkleMesh);
      this.glitterSparkles.push({
        mesh: sparkleMesh,
        baseY,
        radius,
        orbitSpeed,
        orbitAngle,
        baseScale,
        twinklePhase: i * 1.6,
        rotSpeedX: 2.0 + (i % 3) * 1.5,
        rotSpeedY: 2.5 + (i % 2) * 2.0,
      });
    }

    return group;
  }

  /**
   * Returns the exact world position of the bobber's line eyelet/stem,
   * tracking all bobbing, tilting, plunging, and struggle movement.
   */
  getLineAttachmentWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return this.attachmentAnchor.getWorldPosition(target);
  }

  /** Returns current world position of the bobber body. */
  getWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return this.body.getWorldPosition(target);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Kicks off a cast arc from `start` to `end` (world space) over `durationSeconds`. */
  throwTo(start: THREE.Vector3, end: THREE.Vector3, durationSeconds: number): void {
    this.throwState = { start: start.clone(), end: end.clone(), duration: durationSeconds, elapsed: 0 };
    this.group.position.copy(start);
  }

  update(delta: number, phase: FishingPhase): void {
    if (this.throwState) {
      const t = this.throwState;
      t.elapsed += delta;
      const progress = Math.min(1, t.elapsed / t.duration);
      this.group.position.lerpVectors(t.start, t.end, progress);
      // Parabolic height bump peaking mid-flight
      this.group.position.y += Math.sin(progress * Math.PI) * 0.6;
      if (progress >= 1) this.throwState = null;
    }

    // Animate glitter and core glow for neon super lure whenever visible
    if (this.currentBaitId === 'neon-super-lure') {
      this.glitterClock += delta;
      const t = this.glitterClock;

      // Pulse neon core emissive glow
      if (this.neonCoreMaterial) {
        this.neonCoreMaterial.emissiveIntensity = 0.8 + 0.35 * Math.sin(t * 4.5);
      }

      // Orbit and twinkle each glitter diamond
      for (const sp of this.glitterSparkles) {
        const curAngle = sp.orbitAngle + t * sp.orbitSpeed;
        sp.mesh.position.x = Math.cos(curAngle) * sp.radius;
        sp.mesh.position.z = Math.sin(curAngle) * sp.radius;
        sp.mesh.position.y = sp.baseY + Math.sin(t * 3.8 + sp.twinklePhase) * 0.015;

        // Twinkle scale pulsation
        const twinkle = 0.35 + 0.65 * Math.sin(t * 7.0 + sp.twinklePhase);
        const scale = sp.baseScale * Math.max(0.2, twinkle);
        sp.mesh.scale.setScalar(scale);

        // Self rotation of diamond facets
        sp.mesh.rotation.x += delta * sp.rotSpeedX;
        sp.mesh.rotation.y += delta * sp.rotSpeedY;
      }
    }

    if (phase === 'waiting') {
      this.biteClock = 0;
      this.biteRippleClock = 0;
      this.floatClock += delta;
      this.rippleClock += delta;

      const cycle = (this.rippleClock % 2) / 2;
      this.ripple.visible = true;
      const scale = 1 + cycle * 2.2;
      this.ripple.scale.set(scale, scale, scale);
      (this.ripple.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - cycle);

      // Natural buoy floating motion on water swell
      const bobY = this.waterY + Math.sin(this.floatClock * 2.6) * 0.022 + Math.cos(this.floatClock * 1.5) * 0.008;
      const swayX = Math.sin(this.floatClock * 1.3) * 0.016;
      const swayZ = Math.cos(this.floatClock * 1.1) * 0.014;
      this.body.position.set(swayX, bobY, swayZ);
      this.body.rotation.set(
        Math.cos(this.floatClock * 1.8) * 0.06,
        Math.sin(this.floatClock * 0.8) * 0.12,
        Math.sin(this.floatClock * 2.2) * 0.08,
      );
      this.ripple.position.set(swayX, 0, swayZ);
    } else if (phase === 'bite') {
      this.floatClock = 0;
      this.biteClock += delta;
      this.biteRippleClock += delta;

      // Hooked fish struggle: sharp downward plunges, rapid tail quivers, and erratic lateral darting
      const plunge = -0.16;
      const jerk = -Math.pow(Math.max(0, Math.sin(this.biteClock * 8.0)), 1.8) * 0.08;
      const quiver = Math.sin(this.biteClock * 36.0) * 0.018;
      const totalY = this.waterY + plunge + jerk + quiver;

      // Fish swimming/darting side to side and tugging away from dock along -Z
      const dartX =
        Math.sin(this.biteClock * 6.5) * 0.10 +
        Math.sin(this.biteClock * 17.0) * 0.035 +
        Math.cos(this.biteClock * 2.8) * 0.04;
      const dartZ =
        -0.06 +
        Math.cos(this.biteClock * 5.5) * 0.08 +
        Math.sin(this.biteClock * 14.0) * 0.03 +
        Math.sin(this.biteClock * 2.1) * 0.04;

      // Dynamic 3D tilt: pitching forward in direction of pull, rolling violently, and swiveling
      const tiltX = -0.32 + Math.sin(this.biteClock * 11.0) * 0.28;
      const tiltY = Math.sin(this.biteClock * 5.0) * 0.7;
      const tiltZ = Math.sin(this.biteClock * 13.0) * 0.38 + Math.cos(this.biteClock * 27.0) * 0.16;

      this.body.position.set(dartX, totalY, dartZ);
      this.body.rotation.set(tiltX, tiltY, tiltZ);

      // Agitated splash ripples tracking the thrashing bobber
      this.ripple.visible = true;
      this.ripple.position.set(dartX, 0, dartZ);
      const biteCycle = (this.biteRippleClock % 0.42) / 0.42;
      const splashScale = 0.8 + biteCycle * 2.5;
      this.ripple.scale.set(splashScale, splashScale, splashScale);
      (this.ripple.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - biteCycle);
    } else if (phase === 'casting') {
      // Mid-throw: the arc above owns the bobber's world position entirely.
      this.ripple.visible = false;
      this.rippleClock = 0;
      this.floatClock = 0;
      this.biteClock = 0;
      this.biteRippleClock = 0;
      this.body.position.set(0, 0, 0);
      this.body.rotation.set(0, 0, 0);
    } else {
      this.ripple.visible = false;
      this.rippleClock = 0;
      this.floatClock = 0;
      this.biteClock = 0;
      this.biteRippleClock = 0;
      this.body.position.set(0, this.waterY + 0.06, 0);
      this.body.rotation.set(0, 0, 0);
    }
  }

  dispose(): void {
    if (this.attachmentAnchor.parent) {
      this.attachmentAnchor.parent.remove(this.attachmentAnchor);
    }
    disposeObject3D(this.group);
  }
}
