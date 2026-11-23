import * as THREE from 'three';

/**
 * Owns lighting rig and scene rendering. Directly renders scene to camera
 * with alpha transparency preserved.
 */
export class RenderPipeline {
  readonly hemisphere: THREE.HemisphereLight;
  readonly keyLight: THREE.DirectionalLight;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.hemisphere = new THREE.HemisphereLight('#fff7e2', '#648a72', 1.45);
    this.scene.add(this.hemisphere);

    this.keyLight = new THREE.DirectionalLight('#ffedbf', 2.15);
    this.keyLight.position.set(-6, 10, 6);
    this.keyLight.castShadow = true;
    // Tightened to 512x512 for the 318x496 vertical panel & smooth software/GPU rasterization.
    this.keyLight.shadow.mapSize.set(512, 512);
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
    this.keyLight.shadow.blurSamples = 6;
    this.scene.add(this.keyLight);
  }

  resize(_width: number, _height: number): void {
    // Sizing handled in resizeRenderer
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.scene.remove(this.hemisphere, this.keyLight);
    this.hemisphere.dispose();
    this.keyLight.dispose();
  }
}
