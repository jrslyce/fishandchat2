import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose';
import type { FishingPhase } from '../game/GameState';

/**
 * How fast the pre-bite tugs cycle, in radians/second of the ripple clock.
 * Deliberately under ~10: faster than this and at 60fps the float strobes
 * instead of reading as bobbing up and down.
 */
const NIBBLE_TUG_RATE = 9.5;
/** Peak height of a single tug, in world units. */
const NIBBLE_TUG_AMPLITUDE = 0.06;
/** How far the float is dragged under by the end of the tell, before the full bite dip. */
const NIBBLE_PULL_DEPTH = 0.05;

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
 * top of that once the bobber has landed — including the pre-bite nibble tell, the
 * bobbing that warns the player a fish is about to take the hook.
 */
export class Bobber {
  readonly group = new THREE.Group();
  private body: THREE.Object3D | null = null;
  private readonly ripple: THREE.Mesh;
  private rippleClock = 0;
  private throwState: ThrowState | null = null;

  constructor(private readonly waterY: number) {
    this.group.name = 'bobber';
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
    this.group.add(root);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** Kicks off a cast arc from `start` to `end` (world space) over `durationSeconds`. */
  throwTo(start: THREE.Vector3, end: THREE.Vector3, durationSeconds: number): void {
    this.throwState = { start: start.clone(), end: end.clone(), duration: durationSeconds, elapsed: 0 };
    this.group.position.copy(start);
  }

  /**
   * `nibble` (0..1) is how far into the pre-bite tell the wait is — see
   * FishingStateMachine's `nibbleProgress`. It ramps the idle float into
   * sharp, accelerating dips so the take never arrives unannounced.
   */
  update(delta: number, phase: FishingPhase, nibble = 0): void {
    if (this.throwState) {
      const t = this.throwState;
      t.elapsed += delta;
      const progress = Math.min(1, t.elapsed / t.duration);
      this.group.position.lerpVectors(t.start, t.end, progress);
      // Parabolic height bump peaking mid-flight, same hand-rolled sine-arc idiom used
      // elsewhere in Game.ts for fish leaps.
      this.group.position.y += Math.sin(progress * Math.PI) * 0.6;
      if (progress >= 1) this.throwState = null;
    }

    if (phase === 'waiting') {
      this.rippleClock += delta;
      const cycle = (this.rippleClock % 2) / 2;
      this.ripple.visible = true;
      // The tell tightens the ripple ring as it ramps, so the water reads as
      // disturbed rather than idle even before the float moves much.
      const scale = 1 + cycle * (2.2 - nibble * 1.2);
      this.ripple.scale.set(scale, scale, scale);
      (this.ripple.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - cycle) * (1 + nibble);
      if (this.body) {
        const idleBob = Math.sin(this.rippleClock * 3) * 0.02;
        // Fast tugs riding on a steadily deepening pull under the surface.
        const tug = Math.sin(this.rippleClock * NIBBLE_TUG_RATE) * NIBBLE_TUG_AMPLITUDE * nibble;
        const pullUnder = -NIBBLE_PULL_DEPTH * nibble;
        this.body.position.y = this.waterY + idleBob + tug + pullUnder;
      }
    } else if (phase === 'bite') {
      this.ripple.visible = false;
      if (this.body) this.body.position.y = this.waterY - 0.14;
    } else if (phase === 'casting') {
      // Mid-throw: the arc above owns the bobber's world position entirely.
      this.ripple.visible = false;
      this.rippleClock = 0;
      if (this.body) this.body.position.y = 0;
    } else {
      this.ripple.visible = false;
      this.rippleClock = 0;
      if (this.body) this.body.position.y = this.waterY + 0.06;
    }
  }

  dispose(): void {
    disposeObject3D(this.group);
  }
}
