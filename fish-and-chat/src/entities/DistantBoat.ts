import * as THREE from 'three';

interface SteamParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  initialScale: number;
  targetScale: number;
}

interface WakeParticle {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  initialScale: number;
  targetScale: number;
}

export interface DistantBoatOptions {
  speed?: number;
  minX?: number;
  maxX?: number;
  baseY?: number;
  baseZ?: number;
  initialX?: number;
  hullColor?: string;
}

/**
 * 3D low-poly / voxel fishing trawler placed in the far background on the water surface.
 * Bobbing gently on waves (sin/cos rotation and y-translation) and slowly cruising across
 * the horizon from one side to the other, looping seamlessly. Emits tiny smokestack
 * steam puffs and water wake foam.
 */
export class DistantBoat {
  readonly group = new THREE.Group();
  private readonly boatMesh = new THREE.Group();

  private readonly steamParticles: SteamParticle[] = [];
  private readonly wakeParticles: WakeParticle[] = [];
  private readonly particleRoot = new THREE.Group();

  private readonly materialsToDispose: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];
  private readonly steamGeo: THREE.SphereGeometry;
  private readonly wakeGeo: THREE.PlaneGeometry;

  private speed: number;
  private minX: number;
  private maxX: number;
  private baseY: number;
  private baseZ: number;
  private time = 0;
  private steamTimer = 0;
  private wakeTimer = 0;

  constructor(options: DistantBoatOptions = {}) {
    this.speed = options.speed ?? 0.38;
    this.minX = options.minX ?? -14.0;
    this.maxX = options.maxX ?? 14.0;
    this.baseY = options.baseY ?? -0.05;
    this.baseZ = options.baseZ ?? -9.2;

    this.group.name = 'DistantBoat';
    this.group.position.set(options.initialX ?? -2.2, this.baseY, this.baseZ);

    this.steamGeo = new THREE.SphereGeometry(0.04, 6, 6);
    this.wakeGeo = new THREE.PlaneGeometry(0.24, 0.42);
    this.geometriesToDispose.push(this.steamGeo, this.wakeGeo);

    this.group.add(this.boatMesh);
    this.group.add(this.particleRoot);

    this.buildBoatModel(options.hullColor ?? '#1e3844');
  }

  private buildBoatModel(hullColorHex: string): void {
    // 1. Lower hull (tapered trawler bottom)
    const hullMat = this.createStandardMaterial(hullColorHex, 0.8, 0.2);
    const hullStripeMat = this.createStandardMaterial('#f1f5f9', 0.9, 0.1);
    const deckMat = this.createStandardMaterial('#cbb389', 0.9, 0.1);
    const cabinMat = this.createStandardMaterial('#f8fafc', 0.8, 0.2);
    const roofMat = this.createStandardMaterial('#334155', 0.7, 0.3);
    const windowMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
    this.materialsToDispose.push(windowMat);
    const ironMat = this.createStandardMaterial('#374151', 0.5, 0.5);
    const redMat = this.createStandardMaterial('#dc2626', 0.7, 0.3);
    const woodMastMat = this.createStandardMaterial('#854d0e', 0.8, 0.2);

    // Main hull box
    const hullGeo = new THREE.BoxGeometry(1.4, 0.35, 0.65);
    this.geometriesToDispose.push(hullGeo);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.15;
    this.boatMesh.add(hull);

    // Bow prow wedge (pointing forward in +X cruising direction)
    const bowGeo = new THREE.BoxGeometry(0.5, 0.35, 0.5);
    this.geometriesToDispose.push(bowGeo);
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(0.85, 0.15, 0);
    bow.scale.set(1.0, 1.0, 0.7);
    bow.rotation.y = Math.PI / 4;
    this.boatMesh.add(bow);

    // White gunwale accent stripe along deck rim
    const stripeGeo = new THREE.BoxGeometry(1.6, 0.05, 0.68);
    this.geometriesToDispose.push(stripeGeo);
    const stripe = new THREE.Mesh(stripeGeo, hullStripeMat);
    stripe.position.y = 0.32;
    this.boatMesh.add(stripe);

    // Deck planking
    const deckGeo = new THREE.BoxGeometry(1.5, 0.03, 0.6);
    this.geometriesToDispose.push(deckGeo);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 0.34;
    this.boatMesh.add(deck);

    // Wheelhouse / Cabin
    const cabinGeo = new THREE.BoxGeometry(0.5, 0.44, 0.44);
    this.geometriesToDispose.push(cabinGeo);
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(-0.15, 0.55, 0);
    this.boatMesh.add(cabin);

    // Cabin roof with slight lip
    const roofGeo = new THREE.BoxGeometry(0.58, 0.05, 0.5);
    this.geometriesToDispose.push(roofGeo);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(-0.15, 0.79, 0);
    this.boatMesh.add(roof);

    // Glowing warm cabin windows
    const winGeo = new THREE.BoxGeometry(0.08, 0.12, 0.02);
    this.geometriesToDispose.push(winGeo);

    // Front window facing bow (+X)
    const winFrontGeo = new THREE.BoxGeometry(0.02, 0.12, 0.18);
    this.geometriesToDispose.push(winFrontGeo);
    const winFront = new THREE.Mesh(winFrontGeo, windowMat);
    winFront.position.set(0.11, 0.6, 0);
    this.boatMesh.add(winFront);

    // Side windows
    const winSide1 = new THREE.Mesh(winGeo, windowMat);
    winSide1.position.set(-0.15, 0.6, 0.23);
    this.boatMesh.add(winSide1);

    const winSide2 = new THREE.Mesh(winGeo, windowMat);
    winSide2.position.set(-0.15, 0.6, -0.23);
    this.boatMesh.add(winSide2);

    // Smokestack pipe
    const stackGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.32, 8);
    this.geometriesToDispose.push(stackGeo);
    const stack = new THREE.Mesh(stackGeo, ironMat);
    stack.position.set(-0.52, 0.58, 0);
    stack.rotation.z = -0.12; // tilted slightly backwards
    this.boatMesh.add(stack);

    // Smokestack red rim band
    const bandGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.07, 8);
    this.geometriesToDispose.push(bandGeo);
    const band = new THREE.Mesh(bandGeo, redMat);
    band.position.set(-0.54, 0.7, 0);
    band.rotation.z = -0.12;
    this.boatMesh.add(band);

    // Forward mast with navigation lamp
    const mastGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.95, 6);
    this.geometriesToDispose.push(mastGeo);
    const mast = new THREE.Mesh(mastGeo, woodMastMat);
    mast.position.set(0.42, 0.8, 0);
    this.boatMesh.add(mast);

    // Tiny masthead glowing beacon
    const lampGeo = new THREE.SphereGeometry(0.035, 6, 6);
    this.geometriesToDispose.push(lampGeo);
    const lamp = new THREE.Mesh(lampGeo, windowMat);
    lamp.position.set(0.42, 1.28, 0);
    this.boatMesh.add(lamp);

    // Small red pennant flag fluttering aft
    const flagGeo = new THREE.BoxGeometry(0.18, 0.08, 0.01);
    this.geometriesToDispose.push(flagGeo);
    const flag = new THREE.Mesh(flagGeo, redMat);
    flag.position.set(0.32, 1.25, 0);
    this.boatMesh.add(flag);
  }

  private createStandardMaterial(color: string, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    this.materialsToDispose.push(mat);
    return mat;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  update(delta: number): void {
    this.time += delta;

    // 1. Slow cruising across the horizon from minX to maxX
    const posX = this.group.position.x + this.speed * delta;
    if (posX > this.maxX) {
      this.group.position.x = this.minX;
      this.clearParticles();
    } else {
      this.group.position.x = posX;
    }

    // 2. Gentle wave bobbing (sinusoidal heave, pitch, roll)
    const waveY = Math.sin(this.time * 2.1 + this.group.position.x * 0.3) * 0.028;
    this.group.position.y = this.baseY + waveY;

    this.boatMesh.rotation.x = Math.sin(this.time * 2.0) * 0.03; // pitch
    this.boatMesh.rotation.z = Math.cos(this.time * 1.6) * 0.04; // roll

    if (this.group.visible) {
      // 3. Smokestack steam emission
      this.steamTimer -= delta;
      if (this.steamTimer <= 0) {
        this.steamTimer = 0.32 + Math.random() * 0.1;
        this.emitSteam();
      }

      // 4. Wake ripple emission
      this.wakeTimer -= delta;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = 0.45;
        this.emitWake();
      }
    }

    // 5. Update active particles
    this.updateParticles(delta);
  }

  private emitSteam(): void {
    const mat = new THREE.MeshBasicMaterial({
      color: '#f8fafc',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(this.steamGeo, mat);

    // Smokestack local position: (-0.54, 0.75, 0)
    mesh.position.set(-0.54, 0.75, (Math.random() - 0.5) * 0.04);
    this.particleRoot.add(mesh);

    const velocity = new THREE.Vector3(
      -0.2 - Math.random() * 0.15, // drifting backwards
      0.35 + Math.random() * 0.12, // drifting upwards
      (Math.random() - 0.5) * 0.08,
    );

    this.steamParticles.push({
      mesh,
      velocity,
      life: 1.1,
      maxLife: 1.1,
      initialScale: 0.6,
      targetScale: 2.2,
    });
  }

  private emitWake(): void {
    // Low-poly flat wake foam patch
    const mat = new THREE.MeshBasicMaterial({
      color: '#e2f2fc',
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(this.wakeGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    // Positioned trailing the stern (-0.8 in X)
    mesh.position.set(-0.85, 0.005, (Math.random() - 0.5) * 0.1);
    this.particleRoot.add(mesh);

    this.wakeParticles.push({
      mesh,
      life: 1.4,
      maxLife: 1.4,
      initialScale: 0.8,
      targetScale: 2.5,
    });
  }

  private updateParticles(delta: number): void {
    // Steam
    for (let i = this.steamParticles.length - 1; i >= 0; i--) {
      const p = this.steamParticles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.particleRoot.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.steamParticles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.velocity, delta);
      const t = 1 - p.life / p.maxLife;
      const scale = THREE.MathUtils.lerp(p.initialScale, p.targetScale, t);
      p.mesh.scale.setScalar(scale);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.55;
    }

    // Wake
    for (let i = this.wakeParticles.length - 1; i >= 0; i--) {
      const w = this.wakeParticles[i];
      w.life -= delta;
      if (w.life <= 0) {
        this.particleRoot.remove(w.mesh);
        (w.mesh.material as THREE.Material).dispose();
        this.wakeParticles.splice(i, 1);
        continue;
      }
      // Expand outward as boat leaves it behind
      w.mesh.position.x -= this.speed * delta * 0.4;
      const t = 1 - w.life / w.maxLife;
      const scale = THREE.MathUtils.lerp(w.initialScale, w.targetScale, t);
      w.mesh.scale.set(scale * 1.2, scale * 1.5, 1);
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.45;
    }
  }

  private clearParticles(): void {
    for (const p of this.steamParticles) {
      this.particleRoot.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this.steamParticles.length = 0;

    for (const w of this.wakeParticles) {
      this.particleRoot.remove(w.mesh);
      (w.mesh.material as THREE.Material).dispose();
    }
    this.wakeParticles.length = 0;
  }

  dispose(): void {
    this.clearParticles();

    for (const geo of this.geometriesToDispose) {
      geo.dispose();
    }
    this.geometriesToDispose.length = 0;

    for (const mat of this.materialsToDispose) {
      mat.dispose();
    }
    this.materialsToDispose.length = 0;

    this.group.remove(this.boatMesh);
    this.group.remove(this.particleRoot);
  }
}
