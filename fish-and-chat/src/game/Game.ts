import * as THREE from 'three';
import { AudioEngine } from '../core/AudioEngine';
import { CameraRig } from '../core/CameraRig';
import { EventBus } from '../core/EventBus';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { SaveManager } from '../core/SaveManager';
import { Bobber } from '../entities/Bobber';
import { FishingLine } from '../entities/FishingLine';
import { PlayerCharacter } from '../entities/character/PlayerCharacter';
import { loadImportedAsset, normalizedClone } from '../assets/ImportedAssetRegistry';
import { MODEL_SOURCE_MANIFEST_PUBLIC, SFX_MANIFEST } from '../assets/manifest';
import { CraftingSystem } from '../systems/CraftingSystem';
import { FishbotSystem } from '../systems/FishbotSystem';
import { MuxySystem } from '../systems/MuxySystem';
import { TwitchAuthSystem } from '../systems/TwitchAuthSystem';
import { MarketSystem } from '../systems/MarketSystem';
import { RenderPipeline } from '../systems/RenderPipeline';
import { ThemeManager } from '../systems/ThemeManager';
import { VfxSystem } from '../systems/VfxSystem';
import { WaterSystem } from '../systems/WaterSystem';
import { THEME_PALETTES } from '../assets/MaterialLibrary';
import { Economy } from './Economy';
import { CASTING_ANIM_SECONDS, FishingStateMachine, type FishingPhase } from './GameState';
import { createDefaultSaveState, type GameSaveStateV1 } from './SaveState';
import { type DioramaResult } from '../world/DioramaBuilder';
import type { GameEventMap } from './events';
import { UI } from '../ui/UI';

const AUTOSAVE_INTERVAL_SECONDS = 5;
const WATER_Y = -0.05;

/**
 * Minimal diorama version: only dock, character with fishing pole, and water.
 * Circular bobber close-up view during casting/fishing.
 */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly cameraRig: CameraRig;
  private readonly input: InputController;
  private readonly audio = new AudioEngine();
  private readonly events = new EventBus<GameEventMap>();

  private readonly saveManager = new SaveManager<GameSaveStateV1>(createDefaultSaveState);
  public readonly economy: Economy;
  private readonly marketSystem: MarketSystem;
  private readonly craftingSystem: CraftingSystem;
  private readonly fishbotSystem: FishbotSystem;
  private readonly muxySystem: MuxySystem;
  private readonly twitchAuthSystem: TwitchAuthSystem;
  private readonly fishingState: FishingStateMachine;
  private readonly ui: UI;
  private readonly bobber: Bobber;
  private readonly fishingLine = new FishingLine();
  private readonly water: WaterSystem;
  private readonly themeManager: ThemeManager;
  private readonly renderPipeline: RenderPipeline;
  private readonly vfx: VfxSystem;

  private diorama: DioramaResult;
  private readonly playerCharacter = new PlayerCharacter();
  private viewMode: 'dock' | 'bobber' = 'dock';
  private readonly dockCameraPos = new THREE.Vector3(0, 2.1, 3.4);
  private readonly dockCameraFocus = new THREE.Vector3(0, 0.55, -0.5);

  // Closet live preview: a second small render (same renderer/scene, no
  // second WebGL context) into an offscreen target, read back into a plain
  // 2D <canvas> in the modal each frame the closet is open.
  private closetOpen = false;
  private readonly closetPreviewSize = { width: 220, height: 280 };
  private readonly closetCamera = new THREE.PerspectiveCamera(32, this.closetPreviewSize.width / this.closetPreviewSize.height, 0.05, 20);
  private readonly closetRenderTarget = new THREE.WebGLRenderTarget(this.closetPreviewSize.width, this.closetPreviewSize.height);
  private readonly closetPixelBuffer = new Uint8Array(this.closetPreviewSize.width * this.closetPreviewSize.height * 4);

  private readonly loop = new Loop(
    (delta, elapsed) => this.update(delta, elapsed),
    () => this.render(),
  );

  private frame = 0;
  private elapsed = 0;
  private saveTimer = 0;
  private rippleTimer = 0;
  private ambienceStarted = false;

  private readonly onPageHide = () => this.economy.persist();
  // A Twitch panel is frequently scrolled out of view while still "open" — pause the
  // render/update loop rather than burning GPU/CPU on a tab the viewer can't see.
  private readonly onVisibilityChange = () => {
    if (document.hidden) this.loop.stop();
    else this.loop.start();
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.cameraRig = new CameraRig(this.camera, this.dockCameraPos, this.dockCameraFocus);
    // Render targets default to a linear working color space (the sRGB
    // output transform normally only happens on the final canvas blit) — the
    // closet preview reads pixels straight back out, so it needs the target
    // itself to hold sRGB-encoded values or it comes out looking too dark.
    this.closetRenderTarget.texture.colorSpace = THREE.SRGBColorSpace;

    // Pass canvas as actionSurface and #app as containerSurface so taps register on canvas or anywhere on screen
    this.input = new InputController(this.canvas, this.getElement('#app'));

    this.economy = new Economy(this.saveManager);
    Object.assign(this.audio.mix, this.economy.snapshot.audio);
    this.marketSystem = new MarketSystem(this.economy, this.events);
    this.craftingSystem = new CraftingSystem(this.economy, this.events);
    this.fishbotSystem = new FishbotSystem(this.economy, this.events);
    this.muxySystem = new MuxySystem(this.craftingSystem);
    void this.muxySystem.init();
    this.twitchAuthSystem = new TwitchAuthSystem(this.events);
    void this.twitchAuthSystem.init();
    this.events.on('twitchIdentityResolved', ({ displayName }) => {
      this.ui.showWelcomeName(displayName);
      this.economy.setTwitchDisplayName(displayName);
      this.events.emit('displayNameChanged', { name: this.economy.displayName() });
    });
    this.fishingState = new FishingStateMachine(this.economy, this.events);
    this.ui = new UI(this.economy, this.fishingState, this.marketSystem, this.craftingSystem, this.fishbotSystem, this.muxySystem, this.audio, this.events);
    this.wireLoadingScreen();

    const initialTheme = this.economy.currentTheme();
    const initialPalette = THEME_PALETTES[initialTheme];
    this.water = new WaterSystem(initialPalette.waterShallow, initialPalette.waterDeep);
    this.scene.add(this.water.mesh);

    this.diorama = { root: new THREE.Group(), barnabySlot: new THREE.Group(), fishbotSlot: new THREE.Group(), playerSlot: new THREE.Group(), lilypads: [], clouds: [], diagnostics: { meshCount: 0, propTypeCount: 0 } };
    this.themeManager = new ThemeManager(this.scene, this.water, this.audio, initialTheme, (diorama) => this.onDioramaRebuilt(diorama));

    this.diorama.playerSlot.add(this.playerCharacter.group);
    void this.refreshPlayerSkin();
    this.playerCharacter.setName(this.economy.displayName());
    this.events.on('clothingEquipped', () => void this.refreshPlayerSkin());
    this.events.on('baseToneChanged', () => void this.refreshPlayerSkin());
    this.events.on('displayNameChanged', ({ name }) => this.playerCharacter.setName(name));
    // Closet UI: dolly the (single, shared) main camera onto the player's own
    // slot while customizing, rather than standing up a second WebGL context.
    this.events.on('closetOpened', () => {
      this.closetOpen = true;
      this.playerCharacter.group.position.set(0, 0, 0);
      this.playerCharacter.group.rotation.y = 0;
      this.playerCharacter.setPose('idle');
      const slot = this.diorama.playerSlot.position;
      this.cameraRig.setTarget(new THREE.Vector3(slot.x, slot.y + 0.68, slot.z + 1.2), slot);
    });
    this.events.on('closetClosed', () => {
      this.closetOpen = false;
      this.cameraRig.setTarget(this.dockCameraPos, this.dockCameraFocus);
    });
    this.events.on('phaseChanged', ({ phase }) => this.onFishingPhaseChanged(phase));
    this.events.on('catchResolved', ({ result }) => {
      if (!result.isTrash) this.playerCharacter.setPose('wave');
    });

    this.renderPipeline = new RenderPipeline(this.renderer, this.scene, this.camera);

    this.bobber = new Bobber(WATER_Y);
    this.scene.add(this.bobber.group);
    this.scene.add(this.fishingLine.mesh);

    document.getElementById('debug-perfect-cast')?.addEventListener('click', (e) => {
      this.fishingState.debugPerfectCastMode = !this.fishingState.debugPerfectCastMode;
      const btn = e.target as HTMLElement;
      btn.style.background = this.fishingState.debugPerfectCastMode ? 'rgba(255,0,0,0.5)' : 'rgba(0,0,0,0.5)';
    });

    document.getElementById('debug-auto-fish')?.addEventListener('click', (e) => {
      this.fishingState.autoFishingEnabled = !this.fishingState.autoFishingEnabled;
      const btn = e.target as HTMLElement;
      btn.style.background = this.fishingState.autoFishingEnabled ? 'rgba(0,255,0,0.5)' : 'rgba(0,0,0,0.5)';
    });

    this.bobber.setVisible(false);

    this.vfx = new VfxSystem(this.scene, this.events, {
      getBobberPosition: () => this.bobber.getWorldPosition(new THREE.Vector3()),
      getBarnabyPosition: () => this.diorama.barnabySlot.position,
      getCraftingBenchPosition: () => new THREE.Vector3(-3.6, 0.7, -1.6),
    });

    this.events.on('themeChanged', ({ theme }) => void this.themeManager.setTheme(theme));
    this.events.on('baitEquipped', ({ id }) => this.bobber.setBaitType(id));
    this.bobber.setBaitType(this.economy.equippedBait().id);

    if (import.meta.env.DEV) {
      (window as unknown as { __game_scene?: THREE.Scene }).__game_scene = this.scene;
    }

    this.wireAudioTriggers();
    this.loadHeroAssets();
    this.fishbotSystem.simulateOfflineProgress(this.economy.currentTheme());
    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    resizeRenderer(this.renderer, this.camera);
    this.publishDiagnostics();
  }

  start(): void {
    this.loop.start();
  }

  /**
   * Drives the title screen's loading bar off THREE.DefaultLoadingManager, which every loader in
   * the game uses implicitly (GLTFLoader/FBXLoader/TextureLoader singletons don't take an explicit
   * manager) — so this one hook covers the diorama sky texture, hero GLBs, and Barnaby's FBX
   * animations without each caller needing to report progress separately. A safety timeout
   * enables Cast Off! regardless, so a stalled asset never strands the player on the title screen.
   */
  private wireLoadingScreen(): void {
    let ready = false;
    const markReady = () => {
      if (ready) return;
      ready = true;
      this.ui.setReady();
    };
    THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => {
      this.ui.setLoadProgress(total > 0 ? loaded / total : 1);
    };
    THREE.DefaultLoadingManager.onLoad = markReady;
    window.setTimeout(markReady, 10000);
  }

  /** Subscribes SFX playback to gameplay events (the Phase 3 audio trigger map, realized). */
  private wireAudioTriggers(): void {
    this.events.on('castLocked', () => void this.audio.playSfx(SFX_MANIFEST.castWhoosh));
    this.events.on('phaseChanged', ({ phase }) => {
      if (phase === 'waiting') void this.audio.playSfx(SFX_MANIFEST.bobberSplash);
    });
    this.events.on('biteStarted', () => void this.audio.playSfx(SFX_MANIFEST.biteAlert));
    this.events.on('biteReacted', ({ success }) => {
      if (success) void this.audio.playSfx(SFX_MANIFEST.reelIn);
    });
    this.events.on('catchResolved', ({ result }) => {
      const isBig = result.rarity === 'rare' || result.rarity === 'epic' || result.rarity === 'legendary';
      void this.audio.playSfx(isBig ? SFX_MANIFEST.rareCatchFanfare : SFX_MANIFEST.catchJingle);
    });
    this.events.on('marketSold', () => {
      void this.audio.playSfx(SFX_MANIFEST.coinClink);
    });
    this.events.on('upgradePurchased', ({ ok }) => {
      if (ok) void this.audio.playSfx(SFX_MANIFEST.craftClunk);
    });
    this.events.on('baitPurchased', ({ ok }) => {
      if (ok) void this.audio.playSfx(SFX_MANIFEST.coinClink);
    });
    this.events.on('fishbotPurchased', ({ ok }) => {
      if (ok) void this.audio.playSfx(SFX_MANIFEST.coinClink);
    });
    this.events.on('fishbotClaimed', () => void this.audio.playSfx(SFX_MANIFEST.catchJingle, 0.8));
    (window as any).__FISH_GAME__ = this;
  }

  dispose(): void {
    this.loop.stop();
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.input.dispose();
    this.audio.dispose();
    this.ui.dispose();
    this.bobber.dispose();
    this.fishingLine.dispose();
    this.water.dispose();
    this.themeManager.dispose();
    this.vfx.dispose();
    this.renderPipeline.dispose();
    this.economy.persist();
    this.events.clear();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    (window as any).__FISH_GAME__ = undefined;
  }

  private onDioramaRebuilt(diorama: DioramaResult): void {
    this.diorama = diorama;
    diorama.playerSlot.add(this.playerCharacter.group);
  }

  private async refreshPlayerSkin(): Promise<void> {
    await this.playerCharacter.refreshSkin(this.economy.baseTone(), this.economy.equippedClothing());
  }

  /** Keeps the player character's pose in sync with the real fishing state machine, not just decorative. */
  private onFishingPhaseChanged(phase: FishingPhase): void {
    switch (phase) {
      case 'aiming':
        this.playerCharacter.setPose('fishing');
        this.playerCharacter.setFishingSubPose(phase);
        this.setViewMode('dock');
        break;
      case 'casting':
        this.playerCharacter.setPose('fishing');
        this.playerCharacter.setFishingSubPose(phase);
        this.throwBobber();
        this.setViewMode('bobber');
        break;
      case 'waiting':
      case 'bite':
      case 'resolving':
        this.playerCharacter.setPose('fishing');
        this.playerCharacter.setFishingSubPose(phase);
        this.setViewMode('bobber');
        break;
      case 'celebrating':
        this.playerCharacter.setPose('wave');
        this.setViewMode('dock');
        break;
      default:
        this.playerCharacter.setPose('idle');
        this.setViewMode('dock');
        break;
    }
  }

  private setViewMode(mode: 'dock' | 'bobber'): void {
    this.viewMode = mode;
    this.canvas.classList.toggle('bobber-view', mode === 'bobber');
    const ring = document.getElementById('bobber-circle-ring');
    ring?.classList.toggle('active', mode === 'bobber');

    if (mode === 'dock') {
      this.diorama.root.visible = true;
      this.cameraRig.setTarget(this.dockCameraPos, this.dockCameraFocus);
    } else {
      this.diorama.root.visible = false;
      const bPos = this.bobber.group.position;
      const targetPos = new THREE.Vector3(bPos.x, WATER_Y + 1.25, bPos.z + 1.35);
      const targetFocus = new THREE.Vector3(bPos.x, WATER_Y, bPos.z);
      this.cameraRig.setTarget(targetPos, targetFocus);
    }
  }

  private throwBobber(): void {
    const startPos = this.playerCharacter.getRodTipWorldPosition(new THREE.Vector3());
    const landingPos = new THREE.Vector3(0, WATER_Y, -1.35);
    this.bobber.throwTo(startPos, landingPos, CASTING_ANIM_SECONDS);
  }

  private async loadHeroAssets(): Promise<void> {
    const [bobberAsset] = await Promise.allSettled([
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.bobber),
    ]);

    if (bobberAsset.status === 'fulfilled') {
      this.bobber.setModel(normalizedClone(bobberAsset.value, 0.22));
    }
  }


  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    this.elapsed = elapsed;

    // composer.setSize() reallocates every post-processing render target (bloom's mip
    // chain, vignette pass) — only pay that cost when the canvas actually changed size.
    if (resizeRenderer(this.renderer, this.camera)) {
      this.renderPipeline.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    }

    if (this.input.justPressed()) this.events.emit('actionPressed', {});
    this.fishingState.update(delta, this.input);
    if (this.input.justReleased()) this.events.emit('actionReleased', { heldSeconds: this.input.lastHoldSeconds() });
    this.input.update();

    this.fishbotSystem.update(Date.now(), this.economy.currentTheme());

    if (!this.ambienceStarted && this.audio.isUnlocked()) {
      this.ambienceStarted = true;
      this.themeManager.playCurrentAmbience();
    }

    const phase = this.fishingState.getPhase();
    this.bobber.setBaitType(this.economy.equippedBait().id);
    this.bobber.setVisible(phase === 'casting' || phase === 'waiting' || phase === 'bite' || phase === 'celebrating');
    this.bobber.update(delta, phase);

    const lineTaut = phase === 'casting' || phase === 'waiting' || phase === 'bite';
    this.fishingLine.setVisible(lineTaut);
    if (lineTaut) {
      const lineTier = this.economy.upgradeTier('braided-line');
      this.fishingLine.setTier(lineTier);
      const rodTip = this.playerCharacter.getRodTipWorldPosition(new THREE.Vector3());
      const bobberTip = this.bobber.getLineAttachmentWorldPosition(new THREE.Vector3());
      this.fishingLine.update(rodTip, bobberTip, phase, this.elapsed);
    }

    if (phase === 'waiting') {
      this.rippleTimer -= delta;
      if (this.rippleTimer <= 0) {
        this.rippleTimer = 2;
        const bPos = this.bobber.getWorldPosition(new THREE.Vector3());
        this.water.emitRipple(bPos.x, bPos.z);
      }
    } else if (phase === 'bite') {
      this.rippleTimer -= delta;
      if (this.rippleTimer <= 0) {
        this.rippleTimer = 0.35;
        const bPos = this.bobber.getWorldPosition(new THREE.Vector3());
        this.water.emitRipple(bPos.x, bPos.z);
      }
    } else {
      this.rippleTimer = 0;
    }

    this.water.update(delta);

    if (this.viewMode === 'bobber') {
      const bPos = this.bobber.group.position;
      const targetPos = new THREE.Vector3(bPos.x, WATER_Y + 1.25, bPos.z + 1.35);
      const targetFocus = new THREE.Vector3(bPos.x, WATER_Y, bPos.z);
      this.cameraRig.setTarget(targetPos, targetFocus);
    }

    this.playerCharacter.update(delta);
    this.vfx.update(delta);
    this.ui.update();
    this.cameraRig.update(delta);

    this.saveTimer += delta;
    if (this.saveTimer >= AUTOSAVE_INTERVAL_SECONDS) {
      this.saveTimer = 0;
      this.economy.persist();
    }

    this.publishDiagnostics();
  }

  private render(): void {
    this.renderPipeline.render();
    if (this.closetOpen) this.renderClosetPreview();
  }

  /**
   * Live character preview for the Closet modal: a second render of the same
   * scene from a close-up camera, into an offscreen WebGLRenderTarget, read
   * back into a plain 2D <canvas> in the modal — no second WebGL context, no
   * DOM/canvas coordinate-mapping tricks (the target is a fixed small size
   * independent of where the modal panel actually sits on screen).
   */
  private renderClosetPreview(): void {
    const canvas = document.getElementById('closet-preview') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const slotPos = this.diorama.playerSlot.position;
    // Character faces -Z (DioramaBuilder's playerSlot rotation) — camera sits
    // further along -Z, in front of them, looking back at chest/head height.
    this.closetCamera.position.set(slotPos.x, slotPos.y + 0.65, slotPos.z - 1.9);
    this.closetCamera.lookAt(slotPos.x, slotPos.y + 0.75, slotPos.z);

    const { width, height } = this.closetPreviewSize;
    const prevClearColor = new THREE.Color();
    this.renderer.getClearColor(prevClearColor);
    const prevClearAlpha = this.renderer.getClearAlpha();

    this.renderer.setRenderTarget(this.closetRenderTarget);
    this.renderer.setClearColor(0x8fc9b8, 1);
    this.renderer.clear();
    this.renderer.render(this.scene, this.closetCamera);
    this.renderer.readRenderTargetPixels(this.closetRenderTarget, 0, 0, width, height, this.closetPixelBuffer);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(prevClearColor, prevClearAlpha);

    // WebGL readback is bottom-up; Canvas2D ImageData is top-down.
    const imageData = ctx.createImageData(width, height);
    const rowBytes = width * 4;
    for (let y = 0; y < height; y++) {
      const srcStart = (height - 1 - y) * rowBytes;
      imageData.data.set(this.closetPixelBuffer.subarray(srcStart, srcStart + rowBytes), y * rowBytes);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      state: this.fishingState.getPhase(),
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      world: {
        theme: this.themeManager.theme,
        meshCount: this.diorama.diagnostics.meshCount,
        propTypeCount: this.diorama.diagnostics.propTypeCount,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      },
    };
  }

  private getElement(selector: string): HTMLElement {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
  }
}
