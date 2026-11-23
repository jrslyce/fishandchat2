import * as THREE from 'three';

/** Local sparkle particles along the owner's line while casting. */
export class CastSparkles {
  readonly group = new THREE.Group();
  private readonly stars: THREE.Mesh[] = [];

  constructor() {
    const geometry = new THREE.OctahedronGeometry(0.026);
    const colors = ['#ffe889', '#b5f7ff', '#fff8df'];
    for (let i = 0; i < 12; i++) {
      const star = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
      this.group.add(star);
      this.stars.push(star);
    }
    this.group.visible = false;
  }

  update(start: THREE.Vector3, end: THREE.Vector3, time: number, visible: boolean): void {
    this.group.visible = visible;
    if (!visible) return;
    this.stars.forEach((star, index) => {
      const fraction = ((index / this.stars.length) + time * 0.2) % 1;
      star.position.lerpVectors(start, end, fraction);
      star.position.y += Math.sin(time * 7 + index * 2.4) * 0.035;
      star.scale.setScalar(0.6 + 0.55 * Math.sin(time * 8 + index));
      star.rotation.y += 0.04;
    });
  }

  dispose(): void {
    this.stars[0]?.geometry.dispose();
    for (const star of this.stars) (star.material as THREE.Material).dispose();
  }
}
