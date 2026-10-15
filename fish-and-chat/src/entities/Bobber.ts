import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose';
import type { FishingPhase } from '../game/GameState';

interface ThrowState {
  start: THREE.Vector3;
  end: THREE.Vector3;
  duration: number;
  elapsed: number;
}

/**
 * The fishing bobber: a Tripo-generated red-and-white float (set via `setModel` once its
 * GLB resolves — see Game.ts's `loadHeroAssets`) plus a pulsing ripple ring while waiting.
 * `throwTo` drives a simple parabolic cast arc; `group.position` owns the throw's world
 * position while in flight, and `body`'s local y keeps the small phase-driven bob/dip on
 * top of that once the bobber has landed.
 */
export class Bobber {
  readonly group = new THREE.Group();
  private body: THREE.Object3D | null = null;
  private readonly ripple: THREE.Mesh;
  private rippleClock = 0;
  private floatClock = 0;
  private biteClock = 0;
  private biteRippleClock = 0;
  private throwState: ThrowState | null = null;
  private attachmentAnchor: THREE.Object3D | null = null;

  constructor(private readonly waterY: number) {
    this.ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.22, 24),
      new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    );
    this.ripple.rotation.x = -Math.PI / 2;
    this.ripple.visible = false;
    this.group.add(this.ripple);
  }

  /** Attaches the loaded GLB root as the bobber's visual body. Safe to call once, after construction. */
  setModel(root: THREE.Object3D): void {
    this.body = root;
    this.attachmentAnchor = new THREE.Object3D();
    this.attachmentAnchor.name = 'bobberAttachmentAnchor';
    // The normalized bobber model is ~0.22 units tall; stem/eyelet sits at top.
    this.attachmentAnchor.position.set(0, 0.22, 0);
    this.body.add(this.attachmentAnchor);
    this.group.add(root);
  }

  /**
   * Returns the exact world position of the bobber's line eyelet/stem,
   * tracking all bobbing, tilting, plunging, and struggle movement.
   */
  getLineAttachmentWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    if (this.body && this.attachmentAnchor) {
      return this.attachmentAnchor.getWorldPosition(target);
    }
    target.copy(this.group.position);
    target.y += 0.22;
    return target;
  }

  /** Returns current world position of the bobber body. */
  getWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    if (this.body) {
      return this.body.getWorldPosition(target);
    }
    return target.copy(this.group.position);
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

      if (this.body) {
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
      }
    } else if (phase === 'bite') {
      this.floatClock = 0;
      this.biteClock += delta;
      this.biteRippleClock += delta;

      if (this.body) {
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
      }
    } else if (phase === 'casting') {
      // Mid-throw: the arc above owns the bobber's world position entirely.
      this.ripple.visible = false;
      this.rippleClock = 0;
      this.floatClock = 0;
      this.biteClock = 0;
      this.biteRippleClock = 0;
      if (this.body) {
        this.body.position.set(0, 0, 0);
        this.body.rotation.set(0, 0, 0);
      }
    } else {
      this.ripple.visible = false;
      this.rippleClock = 0;
      this.floatClock = 0;
      this.biteClock = 0;
      this.biteRippleClock = 0;
      if (this.body) {
        this.body.position.set(0, this.waterY + 0.06, 0);
        this.body.rotation.set(0, 0, 0);
      }
    }
  }

  dispose(): void {
    if (this.attachmentAnchor && this.attachmentAnchor.parent) {
      this.attachmentAnchor.parent.remove(this.attachmentAnchor);
    }
    disposeObject3D(this.group);
  }
}
