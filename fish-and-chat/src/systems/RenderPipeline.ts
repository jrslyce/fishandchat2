import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0.35 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      float vignette = smoothstep(0.9, 0.35, dist);
      color.rgb *= mix(1.0 - uStrength, 1.0, vignette);
      gl_FragColor = color;
    }
  `,
};

/**
 * Owns lighting rig + post-processing composer in one place. Renderer
 * base setup (color space, tone mapping, shadow map) stays in core/Renderer.ts;
 * this adds the key/fill lights and the bloom+vignette finishing pass.
 */
export class RenderPipeline {
  readonly hemisphere: THREE.HemisphereLight;
  readonly keyLight: THREE.DirectionalLight;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.hemisphere = new THREE.HemisphereLight('#fff6df', '#5a7a5f', 1.3);
    this.scene.add(this.hemisphere);

    this.keyLight = new THREE.DirectionalLight('#ffedbf', 2.0);
    this.keyLight.position.set(-6, 10, 6);
    this.keyLight.castShadow = true;
    // 1024 is indistinguishable from 2048 at the panel/mobile sizes this actually
    // renders at (a Twitch extension panel is ~318x496), and quarters the VSM blur cost.
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 26;
    // Tightened to the diorama's actual ~6-unit radius (was +/-8, looser than
    // needed) so shadow-map texels land where geometry actually is.
    this.keyLight.shadow.camera.left = -6;
    this.keyLight.shadow.camera.right = 6;
    this.keyLight.shadow.camera.top = 6;
    this.keyLight.shadow.camera.bottom = -6;
    // The terrain top layer is thousands of adjacent same-height InstancedMesh
    // cube faces (a perfectly flat surface with no real relief) — coplanar
    // seams like that are worst-case for shadow acne, since there's no true
    // self-occlusion to resolve, only depth-precision noise. That noise still
    // showed as visible flicker/"ripping" under the market stall and along
    // the far shoreline (dense casters + shadow-frustum edge) even after the
    // first bias pass. Pushed normalBias substantially higher to clear it.
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.09;
    // VSMShadowMap softens via a blur pass on the depth-variance map rather
    // than PCF sampling; radius is that blur's size in shadow-map texels.
    // blurSamples=16 (up from the default 8) measurably slowed rendering
    // enough to make Playwright's screenshot capture time out — the acne fix
    // above comes from normalBias, not blur sample count, so keep this cheap.
    this.keyLight.shadow.radius = 4;
    this.keyLight.shadow.blurSamples = 8;
    this.scene.add(this.keyLight);

    this.setupComposer();
  }

  private setupComposer(): void {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(size, 0.35, 0.6, 0.9);
    this.composer.addPass(this.bloomPass);

    const vignettePass = new ShaderPass(VIGNETTE_SHADER);
    this.composer.addPass(vignettePass);
  }

  resize(width: number, height: number): void {
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(width, height);
  }

  render(): void {
    // EffectComposer resets renderer.info between passes, which makes the
    // published diagnostics report only the final full-screen quad (1 call /
    // 1 triangle). Accumulate across the whole frame instead and reset here.
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    this.composer?.render();
  }

  dispose(): void {
    this.scene.remove(this.hemisphere, this.keyLight);
    this.hemisphere.dispose();
    this.keyLight.dispose();
  }
}
