import * as THREE from 'three';

/** A persistent premium prop on the angler's dock, with a brighter opening flourish on unlock. */
export class BottomlessTackleBox {
  readonly group = new THREE.Group();
  private readonly lid = new THREE.Group();
  private readonly glow: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private readonly halo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly sparks: THREE.Mesh[] = [];
  private readonly light = new THREE.PointLight('#ffd76b', 0.65, 1.8);
  private time = 0;
  private celebration = 0;

  constructor() {
    this.group.name = 'bottomlessTackleBox';
    this.group.position.set(0.05, 0.02, -0.18);
    this.group.scale.setScalar(0.65);
    this.group.visible = false;

    const shell = new THREE.MeshStandardMaterial({ color: '#402865', roughness: 0.4, metalness: 0.25 });
    const trim = new THREE.MeshStandardMaterial({ color: '#f7bf46', roughness: 0.28, metalness: 0.7, emissive: '#5c3406', emissiveIntensity: 0.45 });
    const latch = new THREE.MeshStandardMaterial({ color: '#ffe8a0', roughness: 0.2, metalness: 0.8, emissive: '#d28b18', emissiveIntensity: 0.65 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.30, 0.37), shell);
    body.position.y = 0.17;
    this.group.add(body);

    for (const x of [-0.22, 0.22]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.32, 0.39), trim);
      band.position.set(x, 0.17, 0);
      this.group.add(band);
    }
    const frontClasp = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.035), latch);
    frontClasp.position.set(0, 0.29, -0.205);
    this.group.add(frontClasp);

    this.glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.43, 0.025, 0.28),
      new THREE.MeshStandardMaterial({ color: '#5fe5fb', emissive: '#1cceec', emissiveIntensity: 1.6, transparent: true, opacity: 0.75 }),
    );
    this.glow.position.y = 0.335;
    this.group.add(this.glow);

    this.lid.position.set(0, 0.32, 0.19);
    const lidTop = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.075, 0.41), shell);
    lidTop.position.set(0, 0.035, -0.19);
    this.lid.add(lidTop);
    for (const x of [-0.22, 0.22]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.085, 0.42), trim);
      band.position.set(x, 0.035, -0.19);
      this.lid.add(band);
    }
    this.group.add(this.lid);

    this.halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.37, 0.012, 5, 24),
      new THREE.MeshBasicMaterial({ color: '#ffdc78', transparent: true, opacity: 0.55 }),
    );
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = 0.42;
    this.group.add(this.halo);

    const sparkleMat = new THREE.MeshBasicMaterial({ color: '#fff1b4' });
    for (let i = 0; i < 8; i++) {
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(i % 3 === 0 ? 0.042 : 0.026), sparkleMat);
      this.sparks.push(spark);
      this.group.add(spark);
    }
    this.light.position.y = 0.48;
    this.group.add(this.light);
  }

  setOwned(owned: boolean): void {
    this.group.visible = owned;
  }

  celebrate(): void {
    this.group.visible = true;
    this.celebration = 3;
  }

  update(delta: number): void {
    if (!this.group.visible) return;
    this.time += delta;
    this.celebration = Math.max(0, this.celebration - delta);
    const burst = this.celebration > 0 ? 1 : 0;
    this.lid.rotation.x = 0.42 + 0.14 * Math.sin(this.time * 2.2) + burst * 0.62;
    this.glow.material.emissiveIntensity = 1.2 + 0.4 * Math.sin(this.time * 3.1) + burst;
    this.light.intensity = 0.45 + 0.14 * Math.sin(this.time * 3.1) + burst * 0.8;
    this.halo.material.opacity = 0.42 + 0.16 * Math.sin(this.time * 2.5) + burst * 0.3;
    this.halo.rotation.z += delta * (0.35 + burst * 1.2);
    this.halo.scale.setScalar(1 + burst * 0.25 + 0.04 * Math.sin(this.time * 2));
    for (let i = 0; i < this.sparks.length; i++) {
      const phase = this.time * (0.7 + burst * 1.3) + i * Math.PI * 2 / this.sparks.length;
      const radius = 0.22 + burst * 0.17;
      this.sparks[i].position.set(Math.cos(phase) * radius, 0.43 + i % 3 * 0.09 + 0.06 * Math.sin(this.time * 3 + i), Math.sin(phase) * radius);
      this.sparks[i].rotation.y += delta * 2;
    }
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
