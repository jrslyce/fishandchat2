import * as THREE from 'three';
import { disposeObject3D } from '../utils/dispose';
import type { FishingPhase } from '../game/GameState';

/** Visual placeholder: sphere bobber + a pulsing ripple ring while waiting. Phase 4 authors the real voxel version. */
export class Bobber {
  readonly group = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly ripple: THREE.Mesh;
  private rippleClock = 0;

  constructor(private readonly waterY: number) {
    this.body = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshStandardMaterial({ color: '#e8483a', roughness: 0.4 }),
    );
    this.body.castShadow = true;
    this.group.add(this.body);

    this.ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.22, 24),
      new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    );
    this.ripple.rotation.x = -Math.PI / 2;
    this.ripple.visible = false;
    this.group.add(this.ripple);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  update(delta: number, phase: FishingPhase): void {
    if (phase === 'waiting') {
      this.rippleClock += delta;
      const cycle = (this.rippleClock % 2) / 2;
      this.ripple.visible = true;
      const scale = 1 + cycle * 2.2;
      this.ripple.scale.set(scale, scale, scale);
      (this.ripple.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - cycle);
      this.body.position.y = this.waterY + Math.sin(this.rippleClock * 3) * 0.02;
    } else if (phase === 'bite') {
      this.ripple.visible = false;
      this.body.position.y = this.waterY - 0.14;
    } else {
      this.ripple.visible = false;
      this.rippleClock = 0;
      this.body.position.y = this.waterY + 0.06;
    }
  }

  dispose(): void {
    disposeObject3D(this.group);
  }
}
