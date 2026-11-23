import * as THREE from 'three';

const STAR_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  attribute float aPhase;
  attribute float aSize;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Multi-harmonic celestial twinkling
    float twinkle = 0.65 + 0.35 * sin(uTime * 3.2 + aPhase);
    gl_PointSize = aSize * (360.0 / -mvPosition.z) * (0.8 + 0.2 * twinkle);
    vAlpha = uOpacity * twinkle;
  }
`;

const STAR_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.003) discard;
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    float soft = smoothstep(0.5, 0.08, dist);
    gl_FragColor = vec4(vColor, soft * vAlpha);
  }
`;

const METEOR_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const METEOR_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    if (uOpacity <= 0.002) discard;
    // Gradient: Bright glowing head at uv.x = 1.0, fading trail down to 0.0
    float trail = pow(vUv.x, 2.2);
    // Vertical beam falloff from center
    float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float alpha = trail * edge * uOpacity;

    vec3 headColor = vec3(1.0, 1.0, 1.0);
    vec3 trailColor = vec3(0.55, 0.85, 1.0);
    vec3 color = mix(trailColor, headColor, vUv.x);

    gl_FragColor = vec4(color, alpha);
  }
`;

const MOON_HALO_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MOON_HALO_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    if (uOpacity <= 0.002) discard;
    float dist = length(vUv - vec2(0.5));
    if (dist > 0.5) discard;
    float glow = pow(smoothstep(0.5, 0.0, dist), 1.8);
    vec3 glowColor = vec3(0.99, 0.94, 0.75); // warm moonlight gold
    gl_FragColor = vec4(glowColor, glow * uOpacity * 0.65);
  }
`;

export interface CelestialSkyOptions {
  initialNightOpacity?: number;
  starCount?: number;
  moonPosition?: THREE.Vector3;
}

/**
 * Distant celestial night sky entity with:
 * - 3D crescent moon mesh positioned high in the night/cosmic sky with soft glow halo.
 * - Background starfield points (small twinkling points with varying brightness & color).
 * - Occasional shooting star / meteor trail streak cutting across the sky at random intervals.
 * - Smooth fade in/out depending on time of day / theme / weather.
 */
export class CelestialSky {
  readonly group = new THREE.Group();

  // Moon components
  private readonly moonGroup = new THREE.Group();
  private readonly moonMesh: THREE.Mesh;
  private readonly moonMaterial: THREE.MeshStandardMaterial;
  private readonly haloMesh: THREE.Mesh;
  private readonly haloMaterial: THREE.ShaderMaterial;

  // Starfield components
  private readonly starfieldMesh: THREE.Points;
  private readonly starfieldMaterial: THREE.ShaderMaterial;

  // Meteor / Shooting star components
  private readonly meteorMesh: THREE.Mesh;
  private readonly meteorMaterial: THREE.ShaderMaterial;
  private meteorActive = false;
  private meteorProgress = 0;
  private readonly meteorDuration = 0.58; // seconds
  private meteorTimer = 8.0; // interval until next shooting star
  private meteorStart = new THREE.Vector3();
  private meteorEnd = new THREE.Vector3();

  // Opacity & state
  private currentNightOpacity = 0;
  private targetNightOpacity = 0;
  private readonly fadeSpeed = 1.2; // opacity units per second
  private time = 0;

  private readonly materialsToDispose: THREE.Material[] = [];
  private readonly geometriesToDispose: THREE.BufferGeometry[] = [];

  constructor(options: CelestialSkyOptions = {}) {
    this.currentNightOpacity = options.initialNightOpacity ?? 0;
    this.targetNightOpacity = this.currentNightOpacity;

    this.group.name = 'CelestialSky';

    // 1. Build 3D Crescent Moon & Glow Halo
    const moonPos = options.moonPosition ?? new THREE.Vector3(-7.2, 7.8, -15.5);
    this.moonGroup.position.copy(moonPos);
    // Slight tilt gives an elegant celestial poise
    this.moonGroup.rotation.set(0.12, 0.28, -0.32);
    this.group.add(this.moonGroup);

    const { moonMesh, moonMat, haloMesh, haloMat } = this.buildMoon();
    this.moonMesh = moonMesh;
    this.moonMaterial = moonMat;
    this.haloMesh = haloMesh;
    this.haloMaterial = haloMat;

    // 2. Build Twinkling Background Starfield
    const { starMesh, starMat } = this.buildStarfield(options.starCount ?? 220);
    this.starfieldMesh = starMesh;
    this.starfieldMaterial = starMat;
    this.group.add(this.starfieldMesh);

    // 3. Build Shooting Star / Meteor Streak
    const { meteorMesh, meteorMat } = this.buildMeteorStreak();
    this.meteorMesh = meteorMesh;
    this.meteorMaterial = meteorMat;
    this.group.add(this.meteorMesh);

    this.applyNightOpacity(this.currentNightOpacity, true);
  }

  private buildMoon(): {
    moonMesh: THREE.Mesh;
    moonMat: THREE.MeshStandardMaterial;
    haloMesh: THREE.Mesh;
    haloMat: THREE.ShaderMaterial;
  } {
    // 3D Crescent Moon shape using ExtrudeGeometry
    const shape = new THREE.Shape();
    const outerR = 1.35;

    // Start at top horn tip (0, outerR)
    shape.moveTo(0, outerR);
    // Clockwise outer circular arc down to bottom horn tip (0, -outerR)
    shape.absarc(0, 0, outerR, Math.PI * 0.5, -Math.PI * 0.5, true);
    // Inner crescent curve carving back up to top horn tip
    shape.bezierCurveTo(outerR * 0.72, -outerR * 0.52, outerR * 0.72, outerR * 0.52, 0, outerR);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.05,
    };

    const moonGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center geometry origin so it rotates cleanly
    moonGeo.center();
    this.geometriesToDispose.push(moonGeo);

    const moonMat = new THREE.MeshStandardMaterial({
      color: '#fffbeb',
      emissive: '#fde047',
      emissiveIntensity: 0.45,
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.materialsToDispose.push(moonMat);

    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonGroup.add(moonMesh);

    // Soft Moon Halo Glow Plane behind the crescent
    const haloGeo = new THREE.PlaneGeometry(4.8, 4.8);
    this.geometriesToDispose.push(haloGeo);

    const haloMat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
      },
      vertexShader: MOON_HALO_VERTEX_SHADER,
      fragmentShader: MOON_HALO_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materialsToDispose.push(haloMat);

    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.set(0, 0, -0.15);
    this.moonGroup.add(haloMesh);

    return { moonMesh, moonMat, haloMesh, haloMat };
  }

  private buildStarfield(count: number): {
    starMesh: THREE.Points;
    starMat: THREE.ShaderMaterial;
    starGeo: THREE.BufferGeometry;
  } {
    const starGeo = new THREE.BufferGeometry();
    this.geometriesToDispose.push(starGeo);

    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    // Palettes for natural star temperature variation
    const starPalette = [
      new THREE.Color('#ffffff'), // Pure white
      new THREE.Color('#fef3c7'), // Warm gold
      new THREE.Color('#e0f2fe'), // Celestial ice blue
      new THREE.Color('#fde68a'), // Radiant yellow-white
    ];

    for (let i = 0; i < count; i++) {
      // Distribute stars across the distant celestial sky hemisphere
      // x: -22 to +22, y: 1.2 to 14.5, z: -22 to -12
      const x = (Math.random() - 0.5) * 44.0;
      const y = 1.2 + Math.random() * 13.5;
      const z = -12.0 - Math.random() * 10.0;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 1.4 + Math.random() * 2.6;

      const col = starPalette[Math.floor(Math.random() * starPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    starGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.materialsToDispose.push(starMat);

    const starMesh = new THREE.Points(starGeo, starMat);
    return { starMesh, starMat, starGeo };
  }

  private buildMeteorStreak(): {
    meteorMesh: THREE.Mesh;
    meteorMat: THREE.ShaderMaterial;
    meteorGeo: THREE.BufferGeometry;
  } {
    // Ribbon mesh: length along X (0 to 1), width along Y
    const meteorGeo = new THREE.PlaneGeometry(3.6, 0.12, 1, 1);
    this.geometriesToDispose.push(meteorGeo);

    // Anchor pivot so x=0 is head, extending backwards
    meteorGeo.translate(-1.8, 0, 0);

    const meteorMat = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: 0 },
      },
      vertexShader: METEOR_VERTEX_SHADER,
      fragmentShader: METEOR_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.materialsToDispose.push(meteorMat);

    const meteorMesh = new THREE.Mesh(meteorGeo, meteorMat);
    meteorMesh.visible = false;

    return { meteorMesh, meteorMat, meteorGeo };
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  isVisible(): boolean {
    return this.group.visible && (this.currentNightOpacity > 0.002 || this.meteorActive);
  }

  /**
   * Sets target night opacity for smooth fading or instant setting.
   * @param opacity value between 0.0 and 1.0 (1.0 = deep night/cosmic, 0.0 = bright day)
   * @param instant if true, snaps opacity immediately without fading
   */
  setNightOpacity(opacity: number, instant = false): void {
    const clamped = THREE.MathUtils.clamp(opacity, 0, 1);
    this.targetNightOpacity = clamped;

    if (instant) {
      this.currentNightOpacity = clamped;
      this.applyNightOpacity(clamped, true);
    }
  }

  getNightOpacity(): number {
    return this.currentNightOpacity;
  }

  /**
   * Triggers a shooting star cutting across the celestial night vault.
   */
  triggerShootingStar(): void {
    if (this.currentNightOpacity < 0.1) return; // invisible during day

    // Randomize trajectory high in the sky
    const startX = -12.0 + Math.random() * 10.0;
    const startY = 8.5 + Math.random() * 4.5;
    const startZ = -14.0 - Math.random() * 4.0;

    const angle = -0.45 - Math.random() * 0.25; // angled down and right
    const travelDistance = 16.0 + Math.random() * 8.0;

    this.meteorStart.set(startX, startY, startZ);
    this.meteorEnd.set(
      startX + Math.cos(angle) * travelDistance,
      startY + Math.sin(angle) * travelDistance,
      startZ,
    );

    this.meteorActive = true;
    this.meteorProgress = 0;
    this.meteorMesh.visible = true;

    // Orient streak along velocity vector
    const dir = new THREE.Vector3().subVectors(this.meteorEnd, this.meteorStart).normalize();
    const rotZ = Math.atan2(dir.y, dir.x);
    this.meteorMesh.rotation.set(0, 0, rotZ);
    this.meteorMesh.position.copy(this.meteorStart);
  }

  update(delta: number): void {
    this.time += delta;

    // 1. Smoothly fade toward target night opacity
    if (Math.abs(this.currentNightOpacity - this.targetNightOpacity) > 0.001) {
      const step = this.fadeSpeed * delta;
      if (this.currentNightOpacity < this.targetNightOpacity) {
        this.currentNightOpacity = Math.min(this.targetNightOpacity, this.currentNightOpacity + step);
      } else {
        this.currentNightOpacity = Math.max(this.targetNightOpacity, this.currentNightOpacity - step);
      }
      this.applyNightOpacity(this.currentNightOpacity);
    }

    // 2. Starfield shader time update
    if (this.currentNightOpacity > 0.002) {
      this.starfieldMaterial.uniforms.uTime.value = this.time;
    }

    // 3. Occasional shooting star scheduler
    if (this.currentNightOpacity > 0.15) {
      this.meteorTimer -= delta;
      if (this.meteorTimer <= 0) {
        this.meteorTimer = 8.0 + Math.random() * 14.0; // every 8-22s during night
        this.triggerShootingStar();
      }
    }

    // 4. Update active shooting star streak
    if (this.meteorActive) {
      this.meteorProgress += delta / this.meteorDuration;
      if (this.meteorProgress >= 1.0) {
        this.meteorActive = false;
        this.meteorMesh.visible = false;
      } else {
        const t = this.meteorProgress;
        this.meteorMesh.position.lerpVectors(this.meteorStart, this.meteorEnd, t);

        // Fade in quickly, then fade out
        let streakAlpha = 1.0;
        if (t < 0.2) {
          streakAlpha = t / 0.2;
        } else if (t > 0.65) {
          streakAlpha = (1.0 - t) / 0.35;
        }
        this.meteorMaterial.uniforms.uOpacity.value = streakAlpha * this.currentNightOpacity;
      }
    }
  }

  private applyNightOpacity(opacity: number, instant = false): void {
    const isVisible = opacity > 0.002 || this.meteorActive;
    this.group.visible = isVisible;

    if (!isVisible && !instant) return;

    this.moonMaterial.opacity = opacity;
    this.haloMaterial.uniforms.uOpacity.value = opacity;
    this.starfieldMaterial.uniforms.uOpacity.value = opacity;
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

    this.moonGroup.remove(this.moonMesh, this.haloMesh);
    this.group.remove(this.moonGroup);
    this.group.remove(this.starfieldMesh);
    this.group.remove(this.meteorMesh);
  }
}
