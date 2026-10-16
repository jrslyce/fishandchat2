import * as THREE from 'three';
import { FishShadow } from '../entities/FishShadow';
import type { EventBus } from '../core/EventBus';
import type { FishingPhase } from '../game/GameState';
import type { GameEventMap } from '../game/events';

export interface FishShadowSystemOptions {
  scene: THREE.Scene;
  events: EventBus<GameEventMap>;
  getBobberPosition: () => THREE.Vector3;
  getPhase: () => FishingPhase;
  getRemainingWaitSeconds: () => number;
  getWaitDurationSeconds: () => number;
  emitRipple: (x: number, z: number) => void;
}

type FishState =
  | 'idle'
  | 'ambient_swimming'
  | 'stalking_bite'
  | 'lunge_bite'
  | 'fighting_bite'
  | 'fleeing';

const BITE_STALK_LEAD_TIME = 2.4; // seconds before bite to begin stalking sequence

/**
 * Generates a random spawn angle prioritizing the open lower/flank areas of the circular
 * bobber window so fish swim through clear, open water in full view of the player.
 */
function randomPondSpawnAngle(): number {
  // Lower half and flanks: 0.1 to PI - 0.1
  // Bottom center is PI * 0.5 (~1.57 rad). Flank right is ~0.2 rad. Flank left is ~2.9 rad.
  const angleChoices = [
    Math.PI * 0.5 + (Math.random() - 0.5) * 0.6, // bottom center
    Math.PI * 0.25 + (Math.random() - 0.5) * 0.4, // bottom right
    Math.PI * 0.75 + (Math.random() - 0.5) * 0.4, // bottom left
    0.2 + Math.random() * 0.35, // right flank
    Math.PI - 0.2 - Math.random() * 0.35, // left flank
  ];
  return angleChoices[Math.floor(Math.random() * angleChoices.length)];
}

/**
 * Maps linear wait progress (0 to 1) into realistic predatory fish stalking:
 * 1. Approach from the rim at medium glide speed (0.0 to 0.65).
 * 2. Slow down into a tense, curious hover/circle near the bait (0.65 to 0.85).
 * 3. Sudden explosive lunge strike into the bobber right as bite triggers (0.85 to 1.0).
 */
function calculateStalkCurveProgress(u: number): number {
  const clamped = Math.max(0, Math.min(1, u));
  if (clamped < 0.65) {
    return (clamped / 0.65) * 0.60;
  } else if (clamped < 0.85) {
    const sub = (clamped - 0.65) / 0.20;
    return 0.60 + sub * 0.15;
  } else {
    const sub = (clamped - 0.85) / 0.15;
    return 0.75 + Math.pow(sub, 1.4) * 0.25;
  }
}

/**
 * Manages realistic underwater fish shadows that visit the bait during waiting
 * and stalk/strike the bobber right before a bite occurs.
 * Features:
 * - Natural Catmull-Rom curved approach trajectories from random directions.
 * - Dynamic swimming speeds with slow curious inspection near the bait.
 * - Guaranteed stalking and strike lunge synchronized with the bite phase.
 * - Underwater thrashing during the bite phase matching bobber jerks.
 * - Startled fleeing reaction when the player reels early or a fish escapes.
 */
export class FishShadowSystem {
  private readonly fish: FishShadow;
  private readonly options: FishShadowSystemOptions;

  private state: FishState = 'idle';

  // Curve tracking
  private activeCurve: THREE.CatmullRomCurve3 | null = null;
  private curveProgress = 0; // 0 to 1
  private curveDuration = 3.2; // seconds
  private curveElapsed = 0;

  // Stalking / bite timing
  private stalkStartTime = 0;
  private lastPhase: FishingPhase = 'idle';
  private ambientScheduledTime = 0;
  private hasAmbientVisitedThisCast = false;
  private castWaitDuration = 0;

  // Bite fight animation
  private fightClock = 0;

  // Fleeing state
  private fleeVelocity = new THREE.Vector3();
  private fleeElapsed = 0;
  private fleeDuration = 0.65;

  // Previous position for velocity & heading calculation
  private prevPosition = new THREE.Vector3();
  private currentSpeed = 0;
  private currentHeading = 0;

  constructor(options: FishShadowSystemOptions) {
    this.options = options;
    // Scale 0.48 provides a perfectly proportioned ~85px fish in the circular viewport
    this.fish = new FishShadow({ baseScale: 0.48 });
    this.fish.setVisible(false);
    options.scene.add(this.fish.group);

    this.bindEvents();

    if (import.meta.env.DEV) {
      (window as any).__FISH_SHADOW_SYSTEM__ = this;
    }
  }

  private bindEvents(): void {
    this.options.events.on('phaseChanged', ({ phase }) => this.onPhaseChanged(phase));
    this.options.events.on('biteStarted', () => this.onBiteStarted());
    this.options.events.on('biteReacted', () => this.onBiteResolved());
    this.options.events.on('catchResolved', () => this.onCatchResolved());
    this.options.events.on('missed', ({ reason }) => this.onMissed(reason));
  }

  setThemeColor(waterDeepHex: string): void {
    this.fish.setThemeColor(waterDeepHex);
  }

  private onPhaseChanged(phase: FishingPhase): void {
    if (phase === 'waiting' && this.lastPhase !== 'waiting') {
      this.startWaitingCast();
    } else if (phase === 'idle' || phase === 'aiming' || phase === 'casting') {
      this.resetToIdle();
    }
    this.lastPhase = phase;
  }

  private startWaitingCast(): void {
    this.castWaitDuration = this.options.getWaitDurationSeconds();
    this.hasAmbientVisitedThisCast = false;

    // If wait is long enough (> 3.8s), schedule an ambient visit
    if (this.castWaitDuration > 3.8) {
      // Appear after 0.8s to 1.8s into the wait
      this.ambientScheduledTime = 0.8 + Math.random() * 1.0;
    } else {
      this.ambientScheduledTime = 999;
    }

    this.state = 'idle';
    this.fish.setVisible(false);
  }

  private onBiteStarted(): void {
    this.state = 'fighting_bite';
    this.fish.setVisible(true);
    this.fish.setDepth(0.0);
    this.fightClock = 0;
  }

  private onBiteResolved(): void {
    // Handled in catchResolved or missed
  }

  private onCatchResolved(): void {
    // Player hooked and caught the fish; shadow fades as fish is reeled in
    this.resetToIdle();
  }

  private onMissed(reason: string): void {
    if (this.state !== 'idle' && this.fish.isVisible()) {
      this.triggerFlee(reason === 'reeled-early' ? 1.6 : 1.3);
    } else {
      this.resetToIdle();
    }
  }

  private triggerFlee(speed = 1.4): void {
    this.state = 'fleeing';
    this.fleeElapsed = 0;
    this.fleeDuration = 0.65;

    const bPos = this.options.getBobberPosition();
    // Flee outward away from bobber and rod tip
    const fPos = this.fish.group.position;
    const dir = new THREE.Vector3().subVectors(fPos, bPos);
    dir.y = 0;
    if (dir.lengthSq() < 0.005) {
      dir.set(Math.cos(this.currentHeading), 0, Math.sin(this.currentHeading));
    } else {
      dir.normalize();
    }

    this.fleeVelocity.copy(dir).multiplyScalar(speed);
  }

  private resetToIdle(): void {
    this.state = 'idle';
    this.fish.setVisible(false);
    this.activeCurve = null;
    this.curveProgress = 0;
  }

  /**
   * Spawns an ambient fish that curves in from the rim of the view, inspects the bait
   * partway around the bobber, and swims away into deep water.
   */
  private spawnAmbientFish(): void {
    const bPos = this.options.getBobberPosition();
    const spawnAngle = randomPondSpawnAngle();
    // Circular bobber viewport has ~0.20-0.22 unit visible radius; spawn at rim
    const spawnRadius = 0.20 + Math.random() * 0.03;
    // Curve through open bottom water (towards PI/2)
    const side = spawnAngle < Math.PI * 0.5 ? 1 : -1;

    // Randomize speed: cautious vs curious glide
    const baseSpeed = 0.18 + Math.random() * 0.08;
    const closeRadius = 0.08 + Math.random() * 0.03; // circling right around bobber

    // 5 Control Points for smooth Catmull-Rom approach, inspect, and exit
    const p0 = new THREE.Vector3(
      bPos.x + Math.cos(spawnAngle) * spawnRadius,
      -0.046,
      bPos.z + Math.sin(spawnAngle) * spawnRadius,
    );

    const a1 = spawnAngle + side * 0.30;
    const p1 = new THREE.Vector3(
      bPos.x + Math.cos(a1) * (spawnRadius * 0.65),
      -0.046,
      bPos.z + Math.sin(a1) * (spawnRadius * 0.65),
    );

    const a2 = a1 + side * 0.35;
    const p2 = new THREE.Vector3(
      bPos.x + Math.cos(a2) * closeRadius,
      -0.046,
      bPos.z + Math.sin(a2) * closeRadius,
    );

    const a3 = a2 + side * 0.35;
    const p3 = new THREE.Vector3(
      bPos.x + Math.cos(a3) * closeRadius,
      -0.046,
      bPos.z + Math.sin(a3) * closeRadius,
    );

    const a4 = a3 + side * 0.30;
    const exitRadius = 0.22 + Math.random() * 0.03;
    const p4 = new THREE.Vector3(
      bPos.x + Math.cos(a4) * exitRadius,
      -0.046,
      bPos.z + Math.sin(a4) * exitRadius,
    );

    this.activeCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4], false, 'catmullrom', 0.5);
    const totalLength = this.activeCurve.getLength();
    this.curveDuration = totalLength / baseSpeed;
    this.curveElapsed = 0;
    this.curveProgress = 0;

    // Scale variation (0.42 to 0.54)
    this.fish.setBaseScale(0.42 + Math.random() * 0.12);
    this.fish.setDepth(0.5);
    this.fish.group.position.copy(p0);
    this.prevPosition.copy(p0);
    this.fish.setVisible(true);
    this.state = 'ambient_swimming';
  }

  /**
   * Spawns or transitions an existing fish into the pre-bite stalker.
   * Guaranteed to reach the bobber precisely when wait time reaches 0.
   */
  private spawnBiteStalker(): void {
    const bPos = this.options.getBobberPosition();

    let p0: THREE.Vector3;
    let spawnAngle: number;
    let side: number;

    const isAmbientNearbyAndVisible =
      this.state === 'ambient_swimming' &&
      this.fish.isVisible() &&
      this.fish.group.position.z >= bPos.z - 0.02;

    if (isAmbientNearbyAndVisible) {
      // Transition the already nearby ambient fish into the striker!
      p0 = this.fish.group.position.clone();
      spawnAngle = Math.atan2(p0.z - bPos.z, p0.x - bPos.x);
      side = spawnAngle < Math.PI * 0.5 ? 1 : -1;
    } else {
      // Spawn new stalker from open water right at visible edge
      spawnAngle = randomPondSpawnAngle();
      side = spawnAngle < Math.PI * 0.5 ? 1 : -1;
      const spawnRadius = 0.20 + Math.random() * 0.03;
      p0 = new THREE.Vector3(
        bPos.x + Math.cos(spawnAngle) * spawnRadius,
        -0.046,
        bPos.z + Math.sin(spawnAngle) * spawnRadius,
      );
      this.fish.setBaseScale(0.46 + Math.random() * 0.08);
      this.fish.setDepth(0.4);
      this.fish.group.position.copy(p0);
      this.prevPosition.copy(p0);
      this.fish.setVisible(true);
    }

    const a1 = spawnAngle + side * 0.35;
    const p1 = new THREE.Vector3(
      bPos.x + Math.cos(a1) * 0.13,
      -0.046,
      bPos.z + Math.sin(a1) * 0.13,
    );

    const a2 = a1 + side * 0.45;
    const p2 = new THREE.Vector3(
      bPos.x + Math.cos(a2) * 0.075,
      -0.046,
      bPos.z + Math.sin(a2) * 0.075,
    );

    const a3 = a2 + side * 0.25;
    const p3 = new THREE.Vector3(
      bPos.x + Math.cos(a3) * 0.035,
      -0.046,
      bPos.z + Math.sin(a3) * 0.035,
    );

    // Strike directly at the bobber position!
    const p4 = new THREE.Vector3(bPos.x, -0.046, bPos.z);

    this.activeCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4], false, 'catmullrom', 0.5);
    this.stalkStartTime = this.options.getRemainingWaitSeconds();
    this.curveDuration = Math.max(0.8, this.stalkStartTime);
    this.curveElapsed = 0;
    this.curveProgress = 0;

    this.state = 'stalking_bite';
  }

  update(delta: number): void {
    const phase = this.options.getPhase();

    if (phase === 'waiting') {
      const waitRemaining = this.options.getRemainingWaitSeconds();
      const waitElapsed = this.castWaitDuration - waitRemaining;

      // 1. Check if it's time for the guaranteed pre-bite stalker
      if (this.state !== 'stalking_bite' && this.state !== 'lunge_bite' && waitRemaining <= BITE_STALK_LEAD_TIME) {
        this.spawnBiteStalker();
      }
      // 2. Otherwise check if it's time to spawn a curious ambient fish
      else if (
        this.state === 'idle' &&
        !this.hasAmbientVisitedThisCast &&
        waitElapsed >= this.ambientScheduledTime &&
        waitRemaining > BITE_STALK_LEAD_TIME + 1.2
      ) {
        this.hasAmbientVisitedThisCast = true;
        this.spawnAmbientFish();
      }

      // Update active swimming paths
      if (this.state === 'stalking_bite' || this.state === 'ambient_swimming') {
        this.updateCurveSwimming(delta, waitRemaining);
      }
    } else if (phase === 'bite') {
      this.updateBiteFight(delta);
    } else if (this.state === 'fleeing') {
      this.updateFleeing(delta);
    }
  }

  private updateCurveSwimming(delta: number, waitRemaining: number): void {
    if (!this.activeCurve) return;

    if (this.state === 'stalking_bite') {
      // Synchronize curve progress directly with remaining wait time:
      // Glide in, tense pause facing bait, explosive lunge strike at remaining = 0
      const linearWaitProgress = 1 - Math.max(0, waitRemaining) / Math.max(0.1, this.stalkStartTime);
      const targetProgress = calculateStalkCurveProgress(linearWaitProgress);
      this.curveProgress = Math.min(1.0, Math.max(this.curveProgress, targetProgress));
    } else {
      // Ambient swimming cruises forward based on curve duration
      this.curveElapsed += delta;
      this.curveProgress = Math.min(1.0, this.curveElapsed / this.curveDuration);

      // If ambient fish completed its path and exited, return to idle
      if (this.curveProgress >= 1.0) {
        this.resetToIdle();
        return;
      }
    }

    const t = this.curveProgress;
    const pos = this.activeCurve.getPointAt(t);
    const tangent = this.activeCurve.getTangentAt(Math.min(0.999, t));

    // Calculate heading from tangent vector (facing along +Z forward)
    const targetHeading = Math.atan2(tangent.x, tangent.z);
    let headingDelta = targetHeading - this.currentHeading;
    while (headingDelta > Math.PI) headingDelta -= Math.PI * 2;
    while (headingDelta < -Math.PI) headingDelta += Math.PI * 2;

    const turnRate = headingDelta / Math.max(0.001, delta);
    this.currentHeading += headingDelta * Math.min(1.0, delta * 12.0);

    // Speed calculation
    const displacement = pos.distanceTo(this.prevPosition);
    this.currentSpeed = displacement / Math.max(0.001, delta);
    this.prevPosition.copy(pos);

    // Depth effect: closer to bobber = crisp and dark, rim = slightly lighter
    const bPos = this.options.getBobberPosition();
    const distToBobber = Math.sqrt((pos.x - bPos.x) ** 2 + (pos.z - bPos.z) ** 2);
    const depthFactor = Math.min(1.0, Math.max(0.0, distToBobber - 0.04) * 4.5);
    this.fish.setDepth(depthFactor);

    this.fish.group.position.copy(pos);
    this.fish.group.rotation.y = this.currentHeading;

    // Tail animation and spine turn flex
    this.fish.update(delta, this.currentSpeed, turnRate);
  }

  private updateBiteFight(delta: number): void {
    this.fightClock += delta;

    const bPos = this.options.getBobberPosition();

    // Erratic thrashing around the bobber: pulling and circling
    const orbitSpeed = 6.0;
    const thrashAngle = this.fightClock * orbitSpeed;
    const thrashRadius = 0.035 + Math.sin(this.fightClock * 8.0) * 0.015;

    const x = bPos.x + Math.cos(thrashAngle) * thrashRadius;
    const z = bPos.z + Math.sin(thrashAngle) * thrashRadius;
    const y = -0.046;

    this.fish.group.position.set(x, y, z);
    // Heading faces along the circular thrash trajectory
    this.fish.group.rotation.y = thrashAngle + Math.PI / 2;
    this.fish.setDepth(0.0);

    // Tail whips rapidly during the fight
    this.fish.update(delta, 1.4, Math.sin(this.fightClock * 10.0) * 3.5);
  }

  private updateFleeing(delta: number): void {
    this.fleeElapsed += delta;
    const progress = Math.min(1.0, this.fleeElapsed / this.fleeDuration);

    // Rapid movement along flee velocity
    this.fish.group.position.addScaledVector(this.fleeVelocity, delta);
    // Dive into depths via opacity and scale
    this.fish.setDepth(progress);

    const speed = this.fleeVelocity.length();
    this.fish.update(delta, speed, 0);

    if (progress >= 1.0) {
      this.resetToIdle();
    }
  }

  /** For testing & inspection */
  getState(): FishState {
    return this.state;
  }

  getFishPosition(): THREE.Vector3 {
    return this.fish.group.position.clone();
  }

  isFishVisible(): boolean {
    return this.fish.isVisible();
  }

  dispose(): void {
    this.fish.dispose();
  }
}
