import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * How the over-the-shoulder shot is framed, in intent rather than world
 * coordinates: the rig derives the camera's actual position from the angler's
 * seat and the point out on the water they are facing.
 */
export interface ShoulderFraming {
  /** How far back along the angler -> water axis the camera sits. */
  distance: number;
  /** Camera height above the angler's seat. */
  height: number;
  /**
   * Slide along the camera's own right axis. Positive pushes the angler
   * toward screen-LEFT and opens the rest of the frame onto the water.
   */
  shoulderOffset: number;
}

/**
 * Fixed over-the-shoulder camera. The angler is seated on the near bank and
 * never moves, so the rig has nothing to chase: it resolves one framing from
 * the seat + the water point being faced, holds it, and adds a slow idle
 * drift so the shot breathes. `focusOn` retargets what it looks at (the
 * closet preview and later focal points) without moving the camera body.
 */
export class CameraRig {
  private readonly basePosition = new THREE.Vector3();
  private readonly anchor = new THREE.Vector3();
  private readonly waterFocus = new THREE.Vector3();
  private readonly focusTarget = new THREE.Vector3();
  private readonly desiredFocus = new THREE.Vector3();
  private driftTime = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    anchor: THREE.Vector3,
    waterFocus: THREE.Vector3,
    private readonly framing: ShoulderFraming,
  ) {
    this.anchor.copy(anchor);
    this.waterFocus.copy(waterFocus);
    this.focusTarget.copy(waterFocus);
    this.desiredFocus.copy(waterFocus);
    this.recomputeBasePosition();
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.focusTarget);
  }

  /** Re-frames the shot around a new seat/water pair (used when the diorama is rebuilt). */
  setAnchor(anchor: THREE.Vector3, waterFocus: THREE.Vector3): void {
    this.anchor.copy(anchor);
    this.waterFocus.copy(waterFocus);
    this.recomputeBasePosition();
  }

  focusOn(target: THREE.Vector3): void {
    this.desiredFocus.copy(target);
  }

  /** Back to looking out over the water, the rig's resting target. */
  focusOnWater(): void {
    this.desiredFocus.copy(this.waterFocus);
  }

  update(delta: number): void {
    this.driftTime += delta;
    // Small at this distance on purpose — the old diorama rig sat ~10 units
    // out, where a 0.35 sway was invisible; from over the shoulder the same
    // number reads as a camera shake.
    const driftX = Math.sin(this.driftTime * 0.08) * 0.12;
    const driftY = Math.sin(this.driftTime * 0.05) * 0.06;

    this.camera.position.set(
      this.basePosition.x + driftX,
      this.basePosition.y + driftY,
      this.basePosition.z,
    );

    const focusLerp = 1 - Math.exp(-delta / 0.6);
    this.focusTarget.lerp(this.desiredFocus, focusLerp);
    this.camera.lookAt(this.focusTarget);
  }

  private recomputeBasePosition(): void {
    // Level (y-flattened) axis from the seat out to the water, so height is
    // owned entirely by `framing.height` rather than leaking in from the
    // focus point's own elevation.
    const forward = new THREE.Vector3()
      .subVectors(this.waterFocus, this.anchor)
      .setY(0);
    if (forward.lengthSq() === 0) forward.set(0, 0, -1);
    forward.normalize();

    // Screen-right for a level camera looking along `forward`: three.js
    // cameras look down their own -Z, so local +X = UP x (-forward).
    const right = new THREE.Vector3()
      .crossVectors(UP, forward.clone().negate())
      .normalize();

    this.basePosition
      .copy(this.anchor)
      .addScaledVector(forward, -this.framing.distance)
      .addScaledVector(right, this.framing.shoulderOffset);
    this.basePosition.y = this.anchor.y + this.framing.height;
  }
}
