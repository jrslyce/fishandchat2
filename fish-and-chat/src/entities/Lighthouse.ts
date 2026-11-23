import * as THREE from 'three';

export interface LighthouseOptions {
  position?: THREE.Vector3;
  rotationSpeed?: number;
  initialFogIntensity?: number;
}

/**
 * 3D voxel / low-poly Lighthouse situated on a distant rocky cliff in the background horizon.
 * Features:
 * - Rocky crag base with subtle moss & stone shading.
 * - Tapered octagonal tower with alternating red-and-white bands.
 * - Observation balcony with railing and a lantern room with warm glowing yellow interior.
 * - Rotating spotlight: conical beam mesh with semi-transparent additive material sweeping 360 degrees.
 * - Fog & atmospheric scaling: beacon brightness and beam visibility scale up during fog/dark weather.
 */
export class Lighthouse {
  readonly group = new THREE.Group();
  private readonly lighthouseMesh = new THREE.Group();
  private readonly spotlightGroup = new THREE.Group();

  private readonly beamMesh: THREE.Mesh;
  private readonly beamMaterial: THREE.MeshBasicMaterial;
  private readonly lensGlowMesh: THREE.Mesh;
  private readonly lensGlowMaterial: THREE.MeshBasicMaterial;

  private readonly materialsToDispose: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];

  private rotationSpeed: number;
  private currentFogIntensity = 0.4;
  private targetFogIntensity = 0.4;

  constructor(options: LighthouseOptions = {}) {
    this.rotationSpeed = options.rotationSpeed ?? 0.65; // ~9.6s per full revolution
    this.currentFogIntensity = options.initialFogIntensity ?? 0.4;
    this.targetFogIntensity = this.currentFogIntensity;

    this.group.name = 'Lighthouse';
    // Distant horizon placement: e.g. x ~ 10, y ~ -0.3, z ~ -13
    const pos = options.position ?? new THREE.Vector3(10.0, -0.3, -13.0);
    this.group.position.copy(pos);

    this.group.add(this.lighthouseMesh);

    // 1. Build Rocky Crag & Lighthouse Architecture
    const lanternY = this.buildArchitecture();

    // 2. Build Rotating Spotlight Beam & Lens
    this.spotlightGroup.position.set(0, lanternY, 0);
    this.lighthouseMesh.add(this.spotlightGroup);

    const { beamMesh, beamMat, lensGlowMesh, lensGlowMat } = this.buildSpotlight();
    this.beamMesh = beamMesh;
    this.beamMaterial = beamMat;
    this.lensGlowMesh = lensGlowMesh;
    this.lensGlowMaterial = lensGlowMat;

    this.updateAtmosphere(0.4, true);
  }

  private buildArchitecture(): number {
    const stoneDarkMat = this.createStandardMaterial('#334155', 0.95, 0.05); // slate rock
    const stoneMossMat = this.createStandardMaterial('#365314', 0.9, 0.05);  // mossy ledge
    const stoneLightMat = this.createStandardMaterial('#475569', 0.95, 0.05);

    const whiteBandMat = this.createStandardMaterial('#f8fafc', 0.8, 0.1);
    const redBandMat = this.createStandardMaterial('#dc2626', 0.75, 0.15);
    const slateDarkMat = this.createStandardMaterial('#1e293b', 0.8, 0.2);
    const metalRailingMat = this.createStandardMaterial('#0f172a', 0.5, 0.5);
    const brassTrimMat = this.createStandardMaterial('#eab308', 0.4, 0.6);

    const lanternGlowMat = new THREE.MeshBasicMaterial({ color: '#fef08a' }); // glowing warm yellow
    this.materialsToDispose.push(lanternGlowMat);

    // --- A. Rocky Crag Base ---
    // Primary rock pedestal
    const cragBaseGeo = new THREE.CylinderGeometry(2.1, 2.7, 1.4, 7);
    this.geometriesToDispose.push(cragBaseGeo);
    const cragBase = new THREE.Mesh(cragBaseGeo, stoneDarkMat);
    cragBase.position.set(0, 0.7, 0);
    cragBase.rotation.y = 0.4;
    this.lighthouseMesh.add(cragBase);

    // Mossy stepped ledges around base
    const mossLedgeGeo1 = new THREE.BoxGeometry(1.6, 0.45, 1.4);
    this.geometriesToDispose.push(mossLedgeGeo1);
    const mossLedge1 = new THREE.Mesh(mossLedgeGeo1, stoneMossMat);
    mossLedge1.position.set(-0.8, 0.95, 0.7);
    mossLedge1.rotation.y = 0.25;
    this.lighthouseMesh.add(mossLedge1);

    const mossLedgeGeo2 = new THREE.BoxGeometry(1.4, 0.5, 1.5);
    this.geometriesToDispose.push(mossLedgeGeo2);
    const mossLedge2 = new THREE.Mesh(mossLedgeGeo2, stoneMossMat);
    mossLedge2.position.set(0.9, 0.85, -0.6);
    mossLedge2.rotation.y = -0.3;
    this.lighthouseMesh.add(mossLedge2);

    // Lower jutting shoreline boulders
    const rockGeo1 = new THREE.DodecahedronGeometry(0.7, 0);
    this.geometriesToDispose.push(rockGeo1);
    const rock1 = new THREE.Mesh(rockGeo1, stoneLightMat);
    rock1.position.set(1.6, 0.35, 0.8);
    rock1.scale.set(1.2, 0.8, 1.0);
    this.lighthouseMesh.add(rock1);

    const rockGeo2 = new THREE.DodecahedronGeometry(0.65, 0);
    this.geometriesToDispose.push(rockGeo2);
    const rock2 = new THREE.Mesh(rockGeo2, stoneDarkMat);
    rock2.position.set(-1.7, 0.3, -0.7);
    rock2.scale.set(1.1, 0.7, 1.3);
    this.lighthouseMesh.add(rock2);

    // Stone foundation slab
    const slabGeo = new THREE.CylinderGeometry(1.4, 1.55, 0.35, 8);
    this.geometriesToDispose.push(slabGeo);
    const slab = new THREE.Mesh(slabGeo, stoneLightMat);
    slab.position.set(0, 1.45, 0);
    this.lighthouseMesh.add(slab);

    // --- B. Tapered Tower (Alternating Red and White Bands) ---
    // Tower height starts at y = 1.625
    let currentY = 1.625;
    const bandHeight = 0.72;
    const bands = [
      { rBot: 1.15, rTop: 1.05, mat: whiteBandMat }, // 1. White base
      { rBot: 1.05, rTop: 0.96, mat: redBandMat },   // 2. Red
      { rBot: 0.96, rTop: 0.88, mat: whiteBandMat }, // 3. White
      { rBot: 0.88, rTop: 0.80, mat: redBandMat },   // 4. Red
      { rBot: 0.80, rTop: 0.72, mat: whiteBandMat }, // 5. White
    ];

    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      const bandGeo = new THREE.CylinderGeometry(b.rTop, b.rBot, bandHeight, 8);
      this.geometriesToDispose.push(bandGeo);
      const bandMesh = new THREE.Mesh(bandGeo, b.mat);
      bandMesh.position.set(0, currentY + bandHeight * 0.5, 0);
      this.lighthouseMesh.add(bandMesh);

      // Add small dark slit windows on alternating tiers
      if (i === 1 || i === 3) {
        const winGeo = new THREE.BoxGeometry(0.08, 0.18, 0.05);
        this.geometriesToDispose.push(winGeo);
        const winMesh = new THREE.Mesh(winGeo, lanternGlowMat);
        const winAngle = i === 1 ? -0.4 : 0.6;
        const radius = (b.rTop + b.rBot) * 0.5;
        winMesh.position.set(Math.sin(winAngle) * radius, currentY + bandHeight * 0.5, Math.cos(winAngle) * radius);
        winMesh.rotation.y = winAngle;
        this.lighthouseMesh.add(winMesh);
      }

      currentY += bandHeight;
    }

    // --- C. Observation Balcony & Railing ---
    // Balcony corbel trim support
    const corbelGeo = new THREE.CylinderGeometry(0.85, 0.72, 0.16, 8);
    this.geometriesToDispose.push(corbelGeo);
    const corbel = new THREE.Mesh(corbelGeo, slateDarkMat);
    corbel.position.set(0, currentY + 0.08, 0);
    this.lighthouseMesh.add(corbel);
    currentY += 0.16;

    // Balcony deck platform
    const balconyGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.1, 8);
    this.geometriesToDispose.push(balconyGeo);
    const balcony = new THREE.Mesh(balconyGeo, slateDarkMat);
    balcony.position.set(0, currentY + 0.05, 0);
    this.lighthouseMesh.add(balcony);

    // Balcony Railing: 8 posts and perimeter top rail
    const postGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4);
    this.geometriesToDispose.push(postGeo);
    const railRadius = 0.98;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const post = new THREE.Mesh(postGeo, metalRailingMat);
      post.position.set(Math.cos(angle) * railRadius, currentY + 0.25, Math.sin(angle) * railRadius);
      this.lighthouseMesh.add(post);
    }

    // Top railing hoop (approximated by ring or octagonal cylinder tube)
    const railRingGeo = new THREE.CylinderGeometry(railRadius, railRadius, 0.04, 8, 1, true);
    this.geometriesToDispose.push(railRingGeo);
    const railRing = new THREE.Mesh(railRingGeo, metalRailingMat);
    railRing.position.set(0, currentY + 0.42, 0);
    this.lighthouseMesh.add(railRing);

    currentY += 0.1;

    // --- D. Lantern Room ---
    // Lantern room pedestal base
    const lanternBaseGeo = new THREE.CylinderGeometry(0.68, 0.72, 0.15, 8);
    this.geometriesToDispose.push(lanternBaseGeo);
    const lanternBase = new THREE.Mesh(lanternBaseGeo, slateDarkMat);
    lanternBase.position.set(0, currentY + 0.075, 0);
    this.lighthouseMesh.add(lanternBase);
    currentY += 0.15;

    // Lantern room glass cage mullions (metal pillars)
    const glassPillarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.65, 4);
    this.geometriesToDispose.push(glassPillarGeo);
    const glassRadius = 0.62;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pillar = new THREE.Mesh(glassPillarGeo, metalRailingMat);
      pillar.position.set(Math.cos(angle) * glassRadius, currentY + 0.325, Math.sin(angle) * glassRadius);
      this.lighthouseMesh.add(pillar);
    }

    // Glowing warm yellow incandescent core inside lantern room
    const coreGeo = new THREE.SphereGeometry(0.28, 8, 8);
    this.geometriesToDispose.push(coreGeo);
    const core = new THREE.Mesh(coreGeo, lanternGlowMat);
    const lanternCenterY = currentY + 0.325;
    core.position.set(0, lanternCenterY, 0);
    this.lighthouseMesh.add(core);

    // Inner glowing cylinder
    const innerCylGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.48, 8);
    this.geometriesToDispose.push(innerCylGeo);
    const innerCyl = new THREE.Mesh(innerCylGeo, lanternGlowMat);
    innerCyl.position.set(0, lanternCenterY, 0);
    this.lighthouseMesh.add(innerCyl);

    currentY += 0.65;

    // --- E. Cupola Roof & Spire ---
    // Domed/conical roof
    const roofGeo = new THREE.ConeGeometry(0.78, 0.55, 8);
    this.geometriesToDispose.push(roofGeo);
    const roof = new THREE.Mesh(roofGeo, redBandMat);
    roof.position.set(0, currentY + 0.275, 0);
    this.lighthouseMesh.add(roof);
    currentY += 0.55;

    // Spire lightning rod with brass finial ball
    const spireGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.45, 4);
    this.geometriesToDispose.push(spireGeo);
    const spire = new THREE.Mesh(spireGeo, metalRailingMat);
    spire.position.set(0, currentY + 0.225, 0);
    this.lighthouseMesh.add(spire);

    const ballGeo = new THREE.SphereGeometry(0.05, 6, 6);
    this.geometriesToDispose.push(ballGeo);
    const ball = new THREE.Mesh(ballGeo, brassTrimMat);
    ball.position.set(0, currentY + 0.45, 0);
    this.lighthouseMesh.add(ball);

    return lanternCenterY;
  }

  private buildSpotlight(): {
    beamMesh: THREE.Mesh;
    beamMat: THREE.MeshBasicMaterial;
    lensGlowMesh: THREE.Mesh;
    lensGlowMat: THREE.MeshBasicMaterial;
  } {
    // Conical spotlight beam:
    // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded)
    // Oriented horizontally and pointing in direction of sweep (-Z in spotlightGroup local space)
    const beamLength = 16.0;
    const beamRadiusStart = 0.16;
    const beamRadiusEnd = 3.2;

    const beamGeo = new THREE.CylinderGeometry(beamRadiusStart, beamRadiusEnd, beamLength, 24, 1, true);
    this.geometriesToDispose.push(beamGeo);

    // Rotate so height axis (Y) aligns with -Z (shooting forward) and slight downward pitch
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.translate(0, 0, -beamLength * 0.5);

    const beamMat = new THREE.MeshBasicMaterial({
      color: '#fffbeb',
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.materialsToDispose.push(beamMat);

    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    // Slight downward pitch (5 degrees) so beam skims distant water
    beamMesh.rotation.x = 0.09;
    this.spotlightGroup.add(beamMesh);

    // Lens glow disc right at beam origin
    const lensGlowGeo = new THREE.PlaneGeometry(0.85, 0.85);
    this.geometriesToDispose.push(lensGlowGeo);

    const lensGlowMat = new THREE.MeshBasicMaterial({
      color: '#fef08a',
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.materialsToDispose.push(lensGlowMat);

    const lensGlowMesh = new THREE.Mesh(lensGlowGeo, lensGlowMat);
    lensGlowMesh.position.set(0, 0, -0.2);
    this.spotlightGroup.add(lensGlowMesh);

    return { beamMesh, beamMat, lensGlowMesh, lensGlowMat };
  }

  private createStandardMaterial(color: string, roughness: number, metalness: number): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    this.materialsToDispose.push(mat);
    return mat;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  isVisible(): boolean {
    return this.group.visible;
  }

  /**
   * Sets fog & atmospheric factor: scales beacon and spotlight beam intensity.
   * e.g. 0.4 for clear day, 1.0 for normal fog/dusk, 2.0+ for dense fog.
   */
  setFogIntensity(factor: number): void {
    this.targetFogIntensity = Math.max(0, factor);
  }

  getFogIntensity(): number {
    return this.currentFogIntensity;
  }

  update(delta: number): void {
    // 1. Continuous 360-degree rotation of spotlight around Y axis
    this.spotlightGroup.rotation.y += this.rotationSpeed * delta;

    // 2. Smoothly adjust beam opacity according to fog and weather intensity
    if (Math.abs(this.currentFogIntensity - this.targetFogIntensity) > 0.01) {
      const step = delta * 1.5;
      if (this.currentFogIntensity < this.targetFogIntensity) {
        this.currentFogIntensity = Math.min(this.targetFogIntensity, this.currentFogIntensity + step);
      } else {
        this.currentFogIntensity = Math.max(this.targetFogIntensity, this.currentFogIntensity - step);
      }
      this.updateAtmosphere(this.currentFogIntensity);
    }
  }

  private updateAtmosphere(factor: number, instant = false): void {
    // In dense fog, the beam scatters strongly, appearing milky and high-contrast
    // Clear weather: base beam opacity ~0.15; Dense fog (factor 2.0): ~0.55
    const beamOpacity = THREE.MathUtils.clamp(0.12 + factor * 0.22, 0.05, 0.65);
    const lensOpacity = THREE.MathUtils.clamp(0.45 + factor * 0.35, 0.3, 0.95);

    if (instant) {
      this.beamMaterial.opacity = beamOpacity;
      this.lensGlowMaterial.opacity = lensOpacity;
    } else {
      this.beamMaterial.opacity = beamOpacity;
      this.lensGlowMaterial.opacity = lensOpacity;
    }
  }

  dispose(): void {
    for (const geo of this.geometriesToDispose) {
      geo.dispose();
    }
    this.geometriesToDispose.length = 0;

    for (const mat of this.materialsToDispose) {
      mat.dispose();
    }
    this.materialsToDispose.length = 0;

    this.spotlightGroup.remove(this.beamMesh, this.lensGlowMesh);
    this.lighthouseMesh.remove(this.spotlightGroup);
    this.group.remove(this.lighthouseMesh);
  }
}
