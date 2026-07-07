import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose';

const LINE_RADIUS = 0.012;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * A thin lit cylinder stretched between the player's rod-tip anchor and the bobber each
 * frame — a lit `MeshStandardMaterial` rather than `THREE.Line` (whose `LineBasicMaterial`
 * is unlit and can't show a specular highlight), so it catches a real glint from
 * RenderPipeline's key light standing in for sun/moonlight.
 */
export class FishingLine {
  readonly mesh: THREE.Mesh;

  constructor() {
    // Unit-height cylinder along +Y; stretched to the hand-bobber distance via scale.y each update.
    const geometry = new THREE.CylinderGeometry(LINE_RADIUS, LINE_RADIUS, 1, 6);
    const material = new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: 0.15, metalness: 0.6 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  /** Stretches and reorients the line's cylinder to run from `start` to `end` (world space). */
  update(start: THREE.Vector3, end: THREE.Vector3): void {
    this.mesh.position.copy(start).add(end).multiplyScalar(0.5);
    this.mesh.scale.set(1, start.distanceTo(end), 1);
    const direction = end.clone().sub(start).normalize();
    if (direction.lengthSq() > 0) this.mesh.quaternion.setFromUnitVectors(UP, direction);
  }

  dispose(): void {
    disposeObject3D(this.mesh);
  }
}
