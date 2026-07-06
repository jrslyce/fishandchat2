import * as THREE from 'three';

/**
 * Fixed-orbit 3/4 diorama camera. The pond scene does not have a moving
 * player to chase; instead the rig holds a gentle framing angle with a
 * slow idle drift, and can be nudged toward focal points (bobber, catch
 * card, market stall) by later systems.
 */
export class CameraRig {
  private readonly basePosition: THREE.Vector3;
  private readonly focusTarget = new THREE.Vector3(0, 0.6, 0);
  private readonly desiredFocus = new THREE.Vector3(0, 0.6, 0);
  private driftTime = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    offset = new THREE.Vector3(0, 7.5, 10.5),
  ) {
    this.basePosition = offset.clone();
    this.camera.position.copy(this.basePosition);
    this.camera.lookAt(this.focusTarget);
  }

  focusOn(target: THREE.Vector3): void {
    this.desiredFocus.copy(target);
  }

  update(delta: number): void {
    this.driftTime += delta;
    const driftX = Math.sin(this.driftTime * 0.08) * 0.35;
    const driftY = Math.sin(this.driftTime * 0.05) * 0.18;

    this.camera.position.set(
      this.basePosition.x + driftX,
      this.basePosition.y + driftY,
      this.basePosition.z,
    );

    const focusLerp = 1 - Math.exp(-delta / 0.6);
    this.focusTarget.lerp(this.desiredFocus, focusLerp);
    this.camera.lookAt(this.focusTarget);
  }
}
