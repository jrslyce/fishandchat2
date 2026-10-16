import * as THREE from 'three';

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec3 pos = position;
    float wave = sin(pos.x * 1.6 + uTime * 1.1) * 0.035 + cos(pos.y * 1.3 - uTime * 0.8) * 0.03;
    pos.z += wave;
    vWave = wave;
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vWorldPos;

  void main() {
    // Horizon fade between z = -7.5 and z = -9.5 in distance
    float horizonAlpha = smoothstep(-9.5, -7.5, vWorldPos.z);
    if (horizonAlpha <= 0.001) discard;

    // Gradient based on depth away from dock
    float depthMix = clamp((-vWorldPos.z + 0.5) / 6.0, 0.0, 1.0);
    vec3 base = mix(uShallow, uDeep, depthMix);

    // Seamless world-space caustics
    vec2 causticUv = vWorldPos.xz * 3.8 + vec2(uTime * 0.15, uTime * 0.1);
    float causticA = sin(causticUv.x) * sin(causticUv.y);
    vec2 causticUv2 = vWorldPos.xz * 3.0 - vec2(uTime * 0.1, uTime * 0.18);
    float causticB = sin(causticUv2.x + 1.5) * sin(causticUv2.y + 1.5);
    float caustic = smoothstep(0.85, 1.0, causticA * causticB * 0.5 + 0.5);

    vec3 color = base + caustic * 0.12 + vWave * 0.6;
    gl_FragColor = vec4(color, horizonAlpha * 0.94);
  }
`;

export class WaterSystem {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly ripples: THREE.Mesh[] = [];
  private readonly rippleGroup = new THREE.Group();
  private time = 0;

  constructor(shallow: string, deep: string) {
    // Plane of 16x18 centered at z=-3.0 covers z from +6.0 to -12.0.
    // In bobber view (target z=-1.35), water fills 100% of the circle with no horizon cutoff.
    // In dock view, water stretches out to the horizon (z=-8.5) with sky transparent above.
    const geometry = new THREE.PlaneGeometry(16, 18, 64, 64);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShallow: { value: new THREE.Color(shallow) },
        uDeep: { value: new THREE.Color(deep) },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(0, -0.05, -3.0);
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    this.mesh.add(this.rippleGroup);

    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.22, 0.235, 64),
        new THREE.MeshBasicMaterial({ color: '#bce8f5', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
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

  emitRipple(worldX: number, worldZ: number): void {
    const ring = this.ripples.find((r) => !r.visible) ?? this.ripples[0];
    // Mesh is at x=0, z=-1.2, rotated -PI/2 on X:
    // local x = worldX - mesh.position.x
    // local y = -(worldZ - mesh.position.z)
    ring.position.set(worldX - this.mesh.position.x, -(worldZ - this.mesh.position.z), 0.01);
    ring.scale.setScalar(1);
    ring.visible = true;
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.35;
    ring.userData.age = 0;
  }

  update(delta: number): void {
    this.time += delta;
    this.material.uniforms.uTime.value = this.time;

    for (const ring of this.ripples) {
      if (!ring.visible) continue;
      ring.userData.age = (ring.userData.age ?? 0) + delta;
      const life = ring.userData.age / 1.4;
      if (life >= 1) {
        ring.visible = false;
        continue;
      }
      
      const scale = 1 + life * 3.5;
      const opacity = 0.35 * (1 - life);
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
