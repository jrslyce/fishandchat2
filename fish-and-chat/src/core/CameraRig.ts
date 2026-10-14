import * as THREE from 'three';

/**
 * Fixed-orbit 3/4 diorama camera. The pond scene does not have a moving
 * player to chase; instead the rig holds a gentle framing angle with a
 * slow idle drift, and can be nudged toward focal points (bobber, catch
 * card, market stall) by later systems.
 */
export class CameraRig {
  private readonly currentPosition: THREE.Vector3;
  private readonly targetPosition: THREE.Vector3;
  private readonly currentFocus = new THREE.Vector3(0, 0.35, 0.1);
  private readonly desiredFocus = new THREE.Vector3(0, 0.35, 0.1);
  private driftTime = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    offset = new THREE.Vector3(0, 1.9, 2.8),
    focus = new THREE.Vector3(0, 0.35, 0.1),
  ) {
    this.currentPosition = offset.clone();
    this.targetPosition = offset.clone();
    this.currentFocus.copy(focus);
    this.desiredFocus.copy(focus);
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentFocus);
  }

  setTarget(position: THREE.Vector3, focus: THREE.Vector3): void {
    this.targetPosition.copy(position);
    this.desiredFocus.copy(focus);
  }

  focusOn(target: THREE.Vector3): void {
    this.desiredFocus.copy(target);
  }

  update(delta: number): void {
    this.driftTime += delta;
    const rate = 1 - Math.exp(-delta / 0.22);
    this.currentPosition.lerp(this.targetPosition, rate);
    this.currentFocus.lerp(this.desiredFocus, rate);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentFocus);
  }
}
