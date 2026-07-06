import * as THREE from 'three';

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vec3 pos = position;
    float wave = sin(pos.x * 1.6 + uTime * 1.1) * 0.035 + cos(pos.y * 1.3 - uTime * 0.8) * 0.03;
    pos.z += wave;
    vWave = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    float centerDist = distance(vUv, vec2(0.5));
    // The mesh is a square plane; clip it to an inscribed circle so the pond
    // stays round. (The terrain rim overlaps this edge, so the hard cutoff is
    // hidden.)
    if (centerDist > 0.5) discard;

    float depthMix = smoothstep(0.0, 0.55, centerDist);
    vec3 base = mix(uShallow, uDeep, depthMix);

    // Simple moving caustic dot grid: two offset sine lattices.
    vec2 causticUv = vUv * 14.0 + vec2(uTime * 0.15, uTime * 0.1);
    float causticA = sin(causticUv.x) * sin(causticUv.y);
    vec2 causticUv2 = vUv * 11.0 - vec2(uTime * 0.1, uTime * 0.18);
    float causticB = sin(causticUv2.x + 1.5) * sin(causticUv2.y + 1.5);
    float caustic = smoothstep(0.85, 1.0, causticA * causticB * 0.5 + 0.5);

    // Alpha low enough that fish swimming just below the surface stay
    // readable as tinted shapes instead of black silhouettes.
    vec3 color = base + caustic * 0.12 + vWave * 0.6;
    gl_FragColor = vec4(color, 0.78);
  }
`;

export class WaterSystem {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly ripples: THREE.Mesh[] = [];
  private readonly rippleGroup = new THREE.Group();
  private time = 0;

  private readonly radius: number;

  constructor(radius: number, shallow: string, deep: string) {
    this.radius = radius;
    // A subdivided plane, NOT CircleGeometry. CircleGeometry is a triangle fan
    // (one shared center vertex + edge vertices, zero interior subdivision), so
    // the vertex-shader wave collapses into large pie-slice facets that visibly
    // sweep/"flash" as the wave phase shifts. A 64x64 plane has real interior
    // vertices for a smooth wave; the fragment shader clips it to a circle.
    const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2, 64, 64);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShallow: { value: new THREE.Color(shallow) },
        uDeep: { value: new THREE.Color(deep) },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    this.mesh.add(this.rippleGroup);

    for (let i = 0; i < 3; i++) {
      // No extra rotation: the parent water mesh is already rotated -PI/2, so
      // a flat ring in mesh-local XY lies in the world horizontal plane.
      // (Adding another -PI/2 here would flip it vertical.)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.2, 0.28, 20),
        new THREE.MeshBasicMaterial({ color: '#eaffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.renderOrder = 2;
      ring.visible = false;
      this.ripples.push(ring);
      this.rippleGroup.add(ring);
    }
  }

  setPalette(shallow: string, deep: string): void {
    (this.material.uniforms.uShallow.value as THREE.Color).set(shallow);
    (this.material.uniforms.uDeep.value as THREE.Color).set(deep);
  }

  /**
   * Triggers a ripple ring expanding from a world-space XZ point on the water
   * surface. The rings live inside the -PI/2-rotated water mesh, whose local
   * (x, y, z) maps to world (x, z, -y) — so world (x, ~0, z) needs local
   * (x, -z, small +z-offset). Getting this wrong floats rings in mid-air.
   */
  emitRipple(worldX: number, worldZ: number): void {
    const ring = this.ripples.find((r) => !r.visible) ?? this.ripples[0];
    ring.position.set(worldX, -worldZ, 0.01);
    ring.scale.setScalar(1);
    ring.visible = true;
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.6;
    ring.userData.age = 0;
  }

  update(delta: number): void {
    this.time += delta;
    this.material.uniforms.uTime.value = this.time;

    for (const ring of this.ripples) {
      if (!ring.visible) continue;
      ring.userData.age = (ring.userData.age ?? 0) + delta;
      
      const centerDist = Math.sqrt(ring.position.x * ring.position.x + ring.position.y * ring.position.y);
      const maxScale = (this.radius - centerDist) / 0.28;
      
      const life = ring.userData.age / 1.4;
      if (life >= 1) {
        ring.visible = false;
        continue;
      }
      
      let scale = 1 + life * 4;
      let opacity = 0.6 * (1 - life);
      
      if (scale > maxScale) {
        scale = maxScale;
        // Fade out quickly if hitting the cap early
        opacity *= Math.max(0, 1 - (ring.userData.age / 1.4) * 2);
      }
      
      ring.scale.setScalar(scale);
      (ring.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    for (const ring of this.ripples) {
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    }
  }
}
