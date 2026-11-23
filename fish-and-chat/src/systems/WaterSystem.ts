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

    // Poured resin depth gradient away from the foreground dock
    float depthMix = clamp((-vWorldPos.z + 0.5) / 6.0, 0.0, 1.0);
    vec3 base = mix(uShallow, uDeep, depthMix);

    // Dual-layer hand-painted turquoise/emerald underwater caustics
    vec2 causticUv = vWorldPos.xz * 3.8 + vec2(uTime * 0.14, uTime * 0.09);
    float causticA = sin(causticUv.x + sin(causticUv.y * 1.4)) * sin(causticUv.y + cos(causticUv.x * 1.3));
    vec2 causticUv2 = vWorldPos.xz * 2.9 - vec2(uTime * 0.09, uTime * 0.16);
    float causticB = sin(causticUv2.x + 1.5) * sin(causticUv2.y + 1.5);
    float caustic = smoothstep(0.72, 1.0, causticA * causticB * 0.5 + 0.5);

    // Analytical glossy resin surface normal for Fresnel & golden sun sparkles
    vec2 p = vWorldPos.xz;
    float dDx = 0.065 * cos(p.x * 2.6 + uTime * 1.1) + 0.04 * cos(p.x * 4.2 - p.y * 2.4 + uTime * 1.6);
    float dDz = -0.055 * sin(p.y * 2.4 - uTime * 0.9) - 0.035 * cos(p.x * 4.2 - p.y * 2.4 + uTime * 1.6);
    vec3 N = normalize(vec3(-dDx, 1.0, -dDz));
    vec3 V = normalize(vec3(0.0, 2.1, 3.4) - vWorldPos);
    float f1 = 1.0 - clamp(dot(N, V), 0.0, 1.0);
    float fresnel = f1 * f1 * f1;

    vec3 sunDir = normalize(vec3(-0.5, 0.82, 0.5));
    vec3 halfVec = normalize(sunDir + V);
    float nh = max(dot(N, halfVec), 0.0);
    float nh2 = nh * nh;
    float nh4 = nh2 * nh2;
    float nh8 = nh4 * nh4;
    float nh16 = nh8 * nh8;
    float spec = nh16 * nh16;
    float shimmer = sin(p.x * 14.0 + uTime * 2.8) * cos(p.y * 13.0 - uTime * 2.2);
    float sparkle = smoothstep(0.45, 0.95, shimmer) * nh16;

    // Subtle poured-resin meniscus foam hugging the dock pilings (z in [0.1, 1.5])
    float dockZMask = smoothstep(-0.25, 0.15, vWorldPos.z) * (1.0 - smoothstep(1.35, 1.7, vWorldPos.z));
    float dockEdgeX = smoothstep(0.72, 1.08, abs(vWorldPos.x)) * (1.0 - smoothstep(1.18, 1.48, abs(vWorldPos.x)));
    float pilingFoam = dockZMask * dockEdgeX * (0.5 + 0.5 * sin(vWorldPos.z * 7.5 + uTime * 1.8));

    vec3 fresnelTint = mix(uShallow, vec3(0.9, 0.97, 0.94), 0.55);
    vec3 color = base + caustic * 0.2 + vWave * 0.45;
    color = mix(color, fresnelTint, fresnel * 0.34);
    color += vec3(1.0, 0.94, 0.72) * (spec * 0.6 + sparkle * 0.68);
    color += vec3(0.96, 0.98, 0.95) * pilingFoam * 0.22;

    float alpha = clamp(horizonAlpha * (0.91 + fresnel * 0.06), 0.0, 0.97);
    gl_FragColor = vec4(color, alpha);
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
    const geometry = new THREE.PlaneGeometry(16, 18, 32, 36);
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
