import * as THREE from 'three';

const RAINBOW_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vLocalPos;

  void main() {
    vUv = uv;
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RAINBOW_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uInnerRadius;
  uniform float uOuterRadius;

  varying vec2 vUv;
  varying vec3 vLocalPos;

  // 7 vibrant spectral colors from inner to outer:
  // Violet, Blue, Cyan, Green, Yellow, Orange, Red
  const vec3 C_VIOLET = vec3(0.55, 0.16, 0.88);
  const vec3 C_BLUE   = vec3(0.08, 0.38, 0.96);
  const vec3 C_CYAN   = vec3(0.04, 0.86, 0.95);
  const vec3 C_GREEN  = vec3(0.12, 0.92, 0.36);
  const vec3 C_YELLOW = vec3(1.00, 0.92, 0.12);
  const vec3 C_ORANGE = vec3(1.00, 0.48, 0.06);
  const vec3 C_RED    = vec3(0.98, 0.14, 0.22);

  vec3 getRainbowColor(float t) {
    float band = clamp(t, 0.0, 1.0) * 6.0;
    if (band < 1.0) return mix(C_VIOLET, C_BLUE, band);
    if (band < 2.0) return mix(C_BLUE, C_CYAN, band - 1.0);
    if (band < 3.0) return mix(C_CYAN, C_GREEN, band - 2.0);
    if (band < 4.0) return mix(C_GREEN, C_YELLOW, band - 3.0);
    if (band < 5.0) return mix(C_YELLOW, C_ORANGE, band - 4.0);
    return mix(C_ORANGE, C_RED, band - 5.0);
  }

  void main() {
    if (uOpacity <= 0.001) discard;

    float r = length(vLocalPos.xy);
    float t = clamp((r - uInnerRadius) / (uOuterRadius - uInnerRadius), 0.0, 1.0);

    // Soft radial edge falloff
    float radialFalloff = smoothstep(0.0, 0.12, t) * smoothstep(1.0, 0.88, t);

    // Fade ends into distant horizon water / mist
    float angle = atan(vLocalPos.y, vLocalPos.x); // 0 to PI
    float horizonFade = smoothstep(0.04, 0.32, angle) * smoothstep(3.14159, 2.82, angle);

    // Subtle atmospheric shimmer
    float shimmer = 1.0 + 0.07 * sin(uTime * 1.6 + vLocalPos.x * 0.35);

    vec3 color = getRainbowColor(t) * shimmer;
    float alpha = radialFalloff * horizonFade * uOpacity * 0.75;
    if (alpha <= 0.002) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;

export interface RainbowArcOptions {
  innerRadius?: number;
  outerRadius?: number;
  position?: THREE.Vector3;
  initialOpacity?: number;
}

/**
 * 3D curved arch geometry in Three.js with vibrant 7-color gradient spectral bands
 * (Red, Orange, Yellow, Green, Cyan, Blue, Violet) and subtle glow/transparency.
 * Positioned across the distant horizon.
 */
export class RainbowArc {
  readonly group = new THREE.Group();
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry: THREE.RingGeometry;

  private currentOpacity = 0;
  private targetOpacity = 0;
  private fadeSpeed = 0.8; // opacity units per second
  private time = 0;

  constructor(options: RainbowArcOptions = {}) {
    const innerRadius = options.innerRadius ?? 8.5;
    const outerRadius = options.outerRadius ?? 11.2;

    this.group.name = 'RainbowArc';

    // Half-ring in the XY plane arching over the horizon
    this.geometry = new THREE.RingGeometry(innerRadius, outerRadius, 96, 12, 0, Math.PI);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: options.initialOpacity ?? 0 },
        uInnerRadius: { value: innerRadius },
        uOuterRadius: { value: outerRadius },
      },
      vertexShader: RAINBOW_VERTEX_SHADER,
      fragmentShader: RAINBOW_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = 3;

    // Distant horizon default placement: z=-13.5, y=-0.6 (roots submerged in distant water)
    const pos = options.position ?? new THREE.Vector3(0, -0.6, -13.5);
    this.mesh.position.copy(pos);
    // Slight backward tilt on X gives grand atmospheric scale
    this.mesh.rotation.x = -0.06;

    this.group.add(this.mesh);

    this.currentOpacity = options.initialOpacity ?? 0;
    this.targetOpacity = this.currentOpacity;
    this.mesh.visible = this.currentOpacity > 0;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  isVisible(): boolean {
    return this.group.visible && this.currentOpacity > 0.001;
  }

  /**
   * Sets target opacity for smooth fading or instant setting.
   * @param opacity value between 0.0 and 1.0
   * @param instant if true, snaps opacity immediately without fading
   */
  setOpacity(opacity: number, instant = false): void {
    const clamped = THREE.MathUtils.clamp(opacity, 0, 1);
    this.targetOpacity = clamped;
    if (instant) {
      this.currentOpacity = clamped;
      this.material.uniforms.uOpacity.value = clamped;
      this.mesh.visible = clamped > 0.001;
    }
  }

  getOpacity(): number {
    return this.currentOpacity;
  }

  update(delta: number): void {
    this.time += delta;
    this.material.uniforms.uTime.value = this.time;

    // Smoothly fade toward target opacity
    if (Math.abs(this.currentOpacity - this.targetOpacity) > 0.001) {
      const step = this.fadeSpeed * delta;
      if (this.currentOpacity < this.targetOpacity) {
        this.currentOpacity = Math.min(this.targetOpacity, this.currentOpacity + step);
      } else {
        this.currentOpacity = Math.max(this.targetOpacity, this.currentOpacity - step);
      }
      this.material.uniforms.uOpacity.value = this.currentOpacity;
      this.mesh.visible = this.currentOpacity > 0.001;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.group.remove(this.mesh);
  }
}
