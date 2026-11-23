import * as THREE from 'three';

/** Dock-side representation of the player's owned fishbots and their selected finish. */
export class CosmeticFishbot {
  readonly group = new THREE.Group();
  private readonly shell = new THREE.MeshStandardMaterial({ color: '#48a7a0', roughness: 0.4, metalness: 0.3 });
  private readonly trim = new THREE.MeshStandardMaterial({ color: '#f1c65e', roughness: 0.3, metalness: 0.6 });
  private readonly stars: THREE.Mesh[] = [];
  private time = 0;

  constructor() {
    this.group.name = 'cosmeticFishbot';
    this.group.position.set(0.7, 0.14, -0.34);
    this.group.scale.setScalar(0.7);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), this.shell);
    body.scale.set(1.2, 0.6, 0.75);
    body.position.y = 0.18;
    this.group.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), this.trim);
    eye.position.set(0, 0.24, -0.23);
    this.group.add(eye);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.42, 6), this.trim);
    antenna.position.set(0, 0.51, 0);
    this.group.add(antenna);
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.025), new THREE.MeshBasicMaterial({ color: '#b7ecff' }));
      star.visible = false;
      this.group.add(star);
      this.stars.push(star);
    }
    this.group.visible = false;
  }

  setAppearance(hasBot: boolean, starlight: boolean): void {
    this.group.visible = hasBot;
    this.shell.color.set(starlight ? '#352c7d' : '#48a7a0');
    this.shell.emissive.set(starlight ? '#2d2a81' : '#000000');
    this.trim.color.set(starlight ? '#c8a7ff' : '#f1c65e');
    for (const star of this.stars) star.visible = starlight;
  }

  update(delta: number): void {
    if (!this.group.visible) return;
    this.time += delta;
    this.group.position.y = 0.14 + 0.03 * Math.sin(this.time * 2);
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      const angle = this.time * 0.9 + i * Math.PI * 2 / this.stars.length;
      star.position.set(Math.cos(angle) * 0.35, 0.36 + 0.1 * Math.sin(this.time * 2 + i), Math.sin(angle) * 0.3);
      star.rotation.y = angle;
    }
  }

  dispose(): void {
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    });
  }
}
