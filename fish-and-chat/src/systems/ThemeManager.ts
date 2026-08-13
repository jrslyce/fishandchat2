import * as THREE from 'three';
import { MaterialLibrary, THEME_PALETTES } from '../assets/MaterialLibrary';
import { buildDiorama, type DioramaResult } from '../world/DioramaBuilder';
import { THEME_CONFIGS } from '../world/themes';
import { AMBIENCE_MANIFEST } from '../assets/manifest';
import type { ThemeId } from '../game/data';
import type { AudioEngine } from '../core/AudioEngine';
import type { WaterSystem } from './WaterSystem';

const textureLoader = new THREE.TextureLoader();
const skyTextureCache = new Map<string, Promise<THREE.Texture>>();

function loadSkyTexture(url: string): Promise<THREE.Texture> {
  const cached = skyTextureCache.get(url);
  if (cached) return cached;
  const promise = textureLoader.loadAsync(url).then((texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
  skyTextureCache.set(url, promise);
  return promise;
}

/**
 * Owns which theme is active: rebuilds the diorama prop set, swaps the sky
 * backdrop and fog, and crossfades ambience. Because forest/ocean/cosmic
 * use entirely different prop families (trees vs coral vs crystals), a
 * theme change rebuilds the diorama rather than recoloring shared geometry.
 */
export class ThemeManager {
  private materials: MaterialLibrary;
  private diorama: DioramaResult;
  private currentTheme: ThemeId;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly water: WaterSystem,
    private readonly audio: AudioEngine,
    initialTheme: ThemeId,
    private readonly onRebuilt: (diorama: DioramaResult) => void,
  ) {
    this.currentTheme = initialTheme;
    this.materials = new MaterialLibrary(THEME_PALETTES[initialTheme]);
    this.diorama = buildDiorama(initialTheme, this.materials);
    this.scene.add(this.diorama.root);
    this.applyAtmosphere(initialTheme);
    onRebuilt(this.diorama);
  }

  get theme(): ThemeId {
    return this.currentTheme;
  }

  get activeDiorama(): DioramaResult {
    return this.diorama;
  }

  /**
   * (Re)starts the active theme's ambience loop. Needed because the
   * constructor-time playAmbience() runs before the AudioContext exists
   * (gesture unlock) and is silently dropped — the game calls this once
   * after unlock.
   */
  playCurrentAmbience(): void {
    const config = THEME_CONFIGS[this.currentTheme];
    void this.audio.playAmbience(AMBIENCE_MANIFEST[config.ambienceKey]);
  }

  /**
   * Rebuilds the current theme's diorama in place, without touching sky, fog or
   * ambience. Used when an asset the builder can only consume synchronously —
   * the imported nature-prop pack — finishes loading after the first build.
   */
  rebuildProps(): void {
    this.scene.remove(this.diorama.root);
    disposeGroup(this.diorama.root);

    this.diorama = buildDiorama(this.currentTheme, this.materials);
    this.scene.add(this.diorama.root);
    this.onRebuilt(this.diorama);
  }

  async setTheme(theme: ThemeId): Promise<void> {
    if (theme === this.currentTheme) return;
    this.currentTheme = theme;

    this.scene.remove(this.diorama.root);
    disposeGroup(this.diorama.root);
    this.materials.dispose();

    this.materials = new MaterialLibrary(THEME_PALETTES[theme]);
    this.diorama = buildDiorama(theme, this.materials);
    this.scene.add(this.diorama.root);

    this.applyAtmosphere(theme);
    this.onRebuilt(this.diorama);
  }

  private applyAtmosphere(theme: ThemeId): void {
    const palette = THEME_PALETTES[theme];
    const config = THEME_CONFIGS[theme];

    this.scene.fog = new THREE.Fog(palette.fog, config.fogNear, config.fogFar);
    this.water.setPalette(palette.waterShallow, palette.waterDeep);

    void loadSkyTexture(config.skyImage).then((texture) => {
      // Guard against a stale async load landing after another theme switch.
      if (this.currentTheme === theme) {
        this.scene.background = texture;
        this.scene.backgroundIntensity = 0.65;
      }
    });

    void this.audio.playAmbience(AMBIENCE_MANIFEST[config.ambienceKey]);
  }

  dispose(): void {
    this.scene.remove(this.diorama.root);
    disposeGroup(this.diorama.root);
    this.materials.dispose();
  }
}

function disposeGroup(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh || (mesh as unknown as THREE.InstancedMesh).isInstancedMesh) {
      // Imported nature props are Object3D.clone()s, which share geometry and
      // material with the library's prototype. Disposing them here would gut
      // the pack for every later rebuild — the library owns their lifetime.
      if (mesh.userData.sharedPrototype) return;
      mesh.geometry?.dispose();
      // Ad-hoc materials created inside buildDiorama (lilypad buds, clouds)
      // are tagged ownedClone; MaterialLibrary materials are shared across
      // rebuilds and disposed by the library itself, so leave them alone.
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat?.userData.ownedClone) mat.dispose();
      }
    }
  });
}
