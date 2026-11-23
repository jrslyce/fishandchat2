import * as THREE from 'three';
import { AudioEngine } from '../core/AudioEngine';
import { CameraRig } from '../core/CameraRig';
import { EventBus } from '../core/EventBus';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { SaveManager } from '../core/SaveManager';
import { Bobber } from '../entities/Bobber';
import { BottomlessTackleBox } from '../entities/BottomlessTackleBox';
import { CosmeticFishbot } from '../entities/CosmeticFishbot';
import { CastSparkles } from '../entities/CastSparkles';
import { FishingLine } from '../entities/FishingLine';
import { PlayerCharacter } from '../entities/character/PlayerCharacter';
import { loadImportedAsset, normalizedClone } from '../assets/ImportedAssetRegistry';
import { MODEL_SOURCE_MANIFEST_PUBLIC, SFX_MANIFEST } from '../assets/manifest';
import { CraftingSystem } from '../systems/CraftingSystem';
import { FishbotSystem } from '../systems/FishbotSystem';
import { MuxySystem } from '../systems/MuxySystem';
import type { ProgressSession } from '../systems/MuxyProgressStore';
import { TwitchAuthSystem } from '../systems/TwitchAuthSystem';
import { MarketSystem } from '../systems/MarketSystem';
import { RenderPipeline } from '../systems/RenderPipeline';
import { ThemeManager } from '../systems/ThemeManager';
import { VfxSystem } from '../systems/VfxSystem';
import { WaterSystem } from '../systems/WaterSystem';
import { FishShadowSystem } from '../systems/FishShadowSystem';
import { LivingWorldSystem } from '../systems/LivingWorldSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { CommunitySystem } from '../systems/CommunitySystem';
import { NarrativeSystem } from '../systems/NarrativeSystem';
import { PondPresenceSystem } from '../systems/PondPresenceSystem';
import { THEME_PALETTES } from '../assets/MaterialLibrary';
import { Economy } from './Economy';
import { CASTING_ANIM_SECONDS, FishingStateMachine, type FishingPhase } from './GameState';
import { createDefaultSaveState, type GameSaveStateV1 } from './SaveState';
import { type DioramaResult } from '../world/DioramaBuilder';
import { CLOTHING_CATALOG } from './data';
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

  private readonly saveManager: SaveManager<GameSaveStateV1>;
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
  private readonly fishShadows: FishShadowSystem;
  public readonly livingWorld: LivingWorldSystem;
  public readonly questSystem: QuestSystem;
  public readonly communitySystem: CommunitySystem;
  public readonly narrativeSystem: NarrativeSystem;
  private readonly pondPresence: PondPresenceSystem;

  private diorama: DioramaResult;
  private readonly playerCharacter = new PlayerCharacter();
  private readonly bottomlessTackleBox = new BottomlessTackleBox();
  private readonly cosmeticFishbot = new CosmeticFishbot();
  private readonly castSparkles = new CastSparkles();
  private viewMode: 'dock' | 'bobber' = 'dock';
  private readonly dockCameraPos = new THREE.Vector3(0, 2.1, 3.4);
  private readonly dockCameraFocus = new THREE.Vector3(0, 0.55, -0.5);

  // A small dedicated portrait set shares the main WebGL context.
  private closetOpen = false;
  private previewClothingId: string | null = null;
  private closetTurn = 0;
  private readonly closetPreviewSize = { width: 320, height: 400 };
  private readonly closetScene = new THREE.Scene();
  private readonly closetCharacter = new PlayerCharacter(() => { this.closetPreviewDirty = true; });
  private readonly closetCamera = new THREE.PerspectiveCamera(32, this.closetPreviewSize.width / this.closetPreviewSize.height, 0.05, 20);
  private readonly closetRenderTarget = new THREE.WebGLRenderTarget(this.closetPreviewSize.width, this.closetPreviewSize.height);
  private readonly closetPixelBuffer = new Uint8Array(this.closetPreviewSize.width * this.closetPreviewSize.height * 4);
  private closetImageData: ImageData | null = null;
  private closetPreviewDirty = true;
  private lastClosetCanvas: HTMLCanvasElement | null = null;
  private lastClosetRenderAt = 0;

  private readonly loop = new Loop(
    (delta, elapsed) => this.update(delta, elapsed),
    () => this.render(),
  );

  private frame = 0;
  private elapsed = 0;
  private saveTimer = 0;
  private rippleTimer = 0;
  private ambienceStarted = false;

  private readonly onPageHide = () => {
    this.economy.persist();
    void this.economy.flushCloudSave(true);
  };
  private readonly onCharacterPointerDown = (event: PointerEvent) => {
    if (event.target !== this.canvas || (event.pointerType === 'mouse' && event.button !== 0) ||
        this.viewMode !== 'dock' || !this.diorama.root.visible ||
        !['idle', 'aiming'].includes(this.fishingState.getPhase())) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.camera.updateMatrixWorld();
    this.playerCharacter.group.updateWorldMatrix(true, true);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(pointer, this.camera);
    if (!ray.intersectObject(this.playerCharacter.group, true).length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.ui.openCloset();
  };
  // A Twitch panel is frequently scrolled out of view while still "open" — pause the
  // render/update loop rather than burning GPU/CPU on a tab the viewer can't see.
  private readonly onVisibilityChange = () => {
    if (document.hidden) this.loop.stop();
    else this.loop.start();
  };

  constructor(private readonly canvas: HTMLCanvasElement, progress?: ProgressSession) {
    this.saveManager = new SaveManager<GameSaveStateV1>(createDefaultSaveState, progress?.initialState, progress?.onSave, progress?.localSaveKey, progress?.flushSave);
    this.renderer = createRenderer(canvas);
    this.cameraRig = new CameraRig(this.camera, this.dockCameraPos, this.dockCameraFocus);
    // Render targets default to a linear working color space (the sRGB
    // output transform normally only happens on the final canvas blit) — the
    // closet preview reads pixels straight back out, so it needs the target
    // itself to hold sRGB-encoded values or it comes out looking too dark.
    this.closetRenderTarget.texture.colorSpace = THREE.SRGBColorSpace;
    this.closetScene.background = new THREE.Color('#c7e4db');
    this.closetCharacter.setRodVisible(true);
    this.closetCharacter.setShowcaseRod(true);
    this.closetCharacter.group.rotation.y = Math.PI;
    this.closetScene.add(this.closetCharacter.group);
    this.closetScene.add(new THREE.HemisphereLight('#ffffff', '#77968d', 2.2));
    const studioKey = new THREE.DirectionalLight('#fff4d9', 3.1);
    studioKey.position.set(-2, 4, -3);
    this.closetScene.add(studioKey);
    const studioRim = new THREE.DirectionalLight('#91bbce', 1.8);
    studioRim.position.set(2, 3, 2);
    this.closetScene.add(studioRim);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.59, 0.1, 32), new THREE.MeshStandardMaterial({ color: '#d2aa70', roughness: 0.82 }));
    plinth.position.y = -0.065;
    this.closetScene.add(plinth);
    const plinthEdge = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.56, 0.025, 32), new THREE.MeshStandardMaterial({ color: '#f8e6bb', metalness: 0.35, roughness: 0.35 }));
    plinthEdge.position.y = -0.01;
    this.closetScene.add(plinthEdge);
    this.closetCamera.position.set(0.68, 0.88, -2.65);
    this.closetCamera.lookAt(0, 0.61, 0);

    // Pass canvas as actionSurface and #app as containerSurface so taps register on canvas or anywhere on screen
    this.input = new InputController(this.canvas, this.getElement('#app'));

    this.economy = new Economy(this.saveManager);
    if (progress) this.economy.setActiveChannel(progress.channelId, progress.channelName, progress.channelAvatarUrl);
    // Every new session begins silent, including sessions with an older saved
    // unmuted preference. Players can turn audio back on in Settings.
    this.economy.setAudioMix({ muted: true });
    Object.assign(this.audio.mix, this.economy.snapshot.audio);
    this.marketSystem = new MarketSystem(this.economy, this.events);
    this.craftingSystem = new CraftingSystem(this.economy, this.events, () => {
      const phase = this.fishingState.getPhase();
      return phase === 'idle' || phase === 'aiming';
    });
    this.fishbotSystem = new FishbotSystem(this.economy, this.events);
    this.muxySystem = new MuxySystem(this.craftingSystem, this.economy, this.events);
    void this.muxySystem.init(progress?.getAuthToken ? { token: progress.getAuthToken(), channelId: progress.channelId } : undefined);
    this.twitchAuthSystem = new TwitchAuthSystem(this.events);
    void this.twitchAuthSystem.init(progress?.initialIdentity);
    this.events.on('twitchIdentityResolved', ({ displayName }) => {
      this.ui.showWelcomeName(displayName);
      this.economy.setTwitchDisplayName(displayName);
      this.events.emit('displayNameChanged', { name: this.economy.displayName() });
    });
    this.fishingState = new FishingStateMachine(this.economy, this.events);
    this.ui = new UI(this.economy, this.fishingState, this.marketSystem, this.craftingSystem, this.fishbotSystem, this.muxySystem, this.audio, this.events);
    this.pondPresence = new PondPresenceSystem(this.economy, this.events,
      progress?.getAuthToken ? { token: progress.getAuthToken(), channelId: progress.channelId } : undefined);
    this.wireLoadingScreen();

    const initialTheme = this.economy.currentTheme();
    const initialPalette = THEME_PALETTES[initialTheme];
    this.water = new WaterSystem(initialPalette.waterShallow, initialPalette.waterDeep);
    this.scene.add(this.water.mesh);

    this.diorama = { root: new THREE.Group(), barnabySlot: new THREE.Group(), fishbotSlot: new THREE.Group(), playerSlot: new THREE.Group(), lilypads: [], clouds: [], diagnostics: { meshCount: 0, propTypeCount: 0 } };
    this.themeManager = new ThemeManager(this.scene, this.water, this.audio, initialTheme, (diorama) => this.onDioramaRebuilt(diorama));

    this.diorama.playerSlot.add(this.playerCharacter.group);
    this.canvas.addEventListener('pointerdown', this.onCharacterPointerDown, { capture: true });
    this.diorama.playerSlot.add(this.bottomlessTackleBox.group);
    this.diorama.playerSlot.add(this.cosmeticFishbot.group);
    this.bottomlessTackleBox.setOwned(this.economy.ownsPremiumItem('bottomless-tackle-box'));
    this.updateCosmeticAppearance();
    this.events.on('candyBarsChanged', () => {
      this.bottomlessTackleBox.setOwned(this.economy.ownsPremiumItem('bottomless-tackle-box'));
      this.updateCosmeticAppearance();
    });
    void this.refreshPlayerSkin();
    this.playerCharacter.setName(this.economy.displayName());
    this.events.on('clothingEquipped', () => void this.refreshPlayerSkin());
    this.events.on('clothingPreviewChanged', ({ id }) => {
      this.previewClothingId = id;
      void this.refreshPlayerSkin();
    });
    this.events.on('baseToneChanged', () => void this.refreshPlayerSkin());
    this.events.on('cosmeticEquipped', () => this.updateCosmeticAppearance());
    this.events.on('displayNameChanged', ({ name }) => this.playerCharacter.setName(name));
    // Closet UI: dolly the (single, shared) main camera onto the player's own
    // slot while customizing, rather than standing up a second WebGL context.
    this.events.on('closetOpened', () => {
      this.closetOpen = true;
      this.closetTurn = 0;
      this.closetPreviewDirty = true;
      this.playerCharacter.group.position.set(0, 0, 0);
      this.playerCharacter.group.rotation.y = 0;
      this.playerCharacter.setPose('idle');
      const slot = this.diorama.playerSlot.position;
      this.cameraRig.setTarget(new THREE.Vector3(slot.x, slot.y + 0.68, slot.z + 1.2), slot);
    });
    this.events.on('closetClosed', () => {
      this.closetOpen = false;
      this.previewClothingId = null;
      this.lastClosetCanvas = null;
      this.closetPreviewDirty = true;
      void this.refreshPlayerSkin();
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
    this.scene.add(this.castSparkles.group);

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

    this.fishShadows = new FishShadowSystem({
      scene: this.scene,
      events: this.events,
      getBobberPosition: () => this.bobber.getWorldPosition(new THREE.Vector3()),
      getPhase: () => this.fishingState.getPhase(),
      getRemainingWaitSeconds: () => this.fishingState.getRemainingWaitSeconds(),
      getWaitDurationSeconds: () => this.fishingState.getWaitDurationSeconds(),
      emitRipple: (x, z) => this.water.emitRipple(x, z),
    });
    this.fishShadows.setThemeColor(initialPalette.waterDeep);

    this.events.on('themeChanged', ({ theme }) => {
      void this.themeManager.setTheme(theme);
      this.livingWorld.setTheme(theme);
      const palette = THEME_PALETTES[theme];
      if (palette) this.fishShadows.setThemeColor(palette.waterDeep);
    });
    this.events.on('baitEquipped', ({ id }) => this.bobber.setBaitType(id));
    this.bobber.setBaitType(this.economy.equippedBait().id);

    this.livingWorld = new LivingWorldSystem({
      scene: this.scene,
      water: this.water,
      events: this.events,
      hemisphereLight: this.renderPipeline.hemisphere,
      keyLight: this.renderPipeline.keyLight,
      initialTheme,
    });
    this.economy.setWeatherProvider(() => this.livingWorld.getWeather());

    this.questSystem = new QuestSystem(this.economy, this.events);
    this.communitySystem = new CommunitySystem(this.economy, this.events, {
      livingWorld: this.livingWorld,
    });
    this.narrativeSystem = new NarrativeSystem(this.scene, this.water, this.audio, this.events, this.economy, this.camera);
    (this.ui as any).setLivingWorld?.(this.livingWorld);
    (this.ui as any).setQuestSystem?.(this.questSystem);
    (this.ui as any).setCommunitySystem?.(this.communitySystem);
    (this.ui as any).setNarrativeSystem?.(this.narrativeSystem);

    this.events.on('premiumItemPurchased', ({ id, ok }) => {
      if (!ok) return;
      if (id === 'rainbow-totem') {
        this.livingWorld.setWeather('rainbow', 300);
      } else if (id === 'whale-call-horn') {
        this.livingWorld.triggerWhaleJump();
      } else if (id === 'bottomless-tackle-box') {
        this.bottomlessTackleBox.celebrate();
      }
      this.updateCosmeticAppearance();
    });

    if (import.meta.env.DEV) {
      (window as unknown as { __game_scene?: THREE.Scene; __livingWorld?: LivingWorldSystem; __questSystem?: QuestSystem; __communitySystem?: CommunitySystem; __narrativeSystem?: NarrativeSystem }).__game_scene = this.scene;
      (window as unknown as { __livingWorld?: LivingWorldSystem }).__livingWorld = this.livingWorld;
      (window as unknown as { __questSystem?: QuestSystem }).__questSystem = this.questSystem;
      (window as unknown as { __communitySystem?: CommunitySystem }).__communitySystem = this.communitySystem;
      (window as unknown as { __narrativeSystem?: NarrativeSystem }).__narrativeSystem = this.narrativeSystem;
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
      if (ok) this.updateCosmeticAppearance();
      if (ok) void this.audio.playSfx(SFX_MANIFEST.coinClink);
    });
    this.events.on('fishbotClaimed', () => void this.audio.playSfx(SFX_MANIFEST.catchJingle, 0.8));

    const synth = this.audio.getSynthesizer();
    let currentWeather = 'clear';
    this.events.on('weatherChanged', ({ weather }) => {
      if (weather === 'rain') {
        synth.playRain(0.35);
      } else if (currentWeather === 'rain' && weather !== 'rain') {
        synth.stopRain();
      }
      if (weather === 'fog') {
        synth.playFoghorn();
      }
      currentWeather = weather;
    });
    this.events.on('whaleJump', () => {
      synth.playWhaleSong();
      synth.playWaterSplash(1.2);
    });
    this.events.on('krakenBreach', () => {
      synth.playWaterSplash(1.5);
      synth.playThunder();
    });
    this.events.on('communityGoalCompleted', () => {
      synth.playFanfare();
    });
    this.events.on('xpGained', ({ leveledUp }) => {
      if (leveledUp) {
        synth.playLevelUp();
      }
    });
    this.events.on('streakChanged', ({ streak }) => {
      if (streak > 0) {
        synth.playStreakCheer();
      }
    });

    (window as any).__FISH_GAME__ = this;
  }

  dispose(): void {
    this.loop.stop();
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.input.dispose();
    this.canvas.removeEventListener('pointerdown', this.onCharacterPointerDown, { capture: true });
    this.audio.dispose();
    this.ui.dispose();
    this.pondPresence.dispose();
    this.bobber.dispose();
    this.bottomlessTackleBox.dispose();
    this.cosmeticFishbot.dispose();
    this.castSparkles.dispose();
    this.fishingLine.dispose();
    this.water.dispose();
    this.themeManager.dispose();
    this.vfx.dispose();
    this.fishShadows.dispose();
    this.livingWorld.dispose();
    this.narrativeSystem.dispose();
    this.renderPipeline.dispose();
    this.playerCharacter.dispose();
    this.closetCharacter.dispose();
    this.closetRenderTarget.dispose();
    this.closetScene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && !this.closetCharacter.group.getObjectById(mesh.id)) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    this.economy.persist();
    this.events.clear();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    (window as any).__FISH_GAME__ = undefined;
  }

  private onDioramaRebuilt(diorama: DioramaResult): void {
    this.diorama = diorama;
    diorama.playerSlot.add(this.playerCharacter.group);
    diorama.playerSlot.add(this.bottomlessTackleBox.group);
    diorama.playerSlot.add(this.cosmeticFishbot.group);
  }

  private async refreshPlayerSkin(): Promise<void> {
    const outfit = { ...this.economy.equippedClothing() };
    const preview = this.closetOpen ? CLOTHING_CATALOG.find((item) => item.id === this.previewClothingId) : null;
    if (preview) outfit[preview.slot] = preview.id;
    await Promise.all([
      this.playerCharacter.refreshSkin(this.economy.baseTone(), outfit),
      this.closetCharacter.refreshSkin(this.economy.baseTone(), outfit),
    ]);
    this.closetPreviewDirty = true;
  }

  private updateCosmeticAppearance(): void {
    const goldenRod = this.economy.cosmeticEquipped('rod') === 'golden-rod-skin';
    this.playerCharacter.setGoldenRod(goldenRod);
    this.closetCharacter.setGoldenRod(goldenRod);
    this.cosmeticFishbot.setAppearance(
      this.economy.ownedFishbots().length > 0,
      this.economy.cosmeticEquipped('fishbot') === 'starlight-fishbot-skin',
    );
    this.closetPreviewDirty = true;
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
    this.cosmeticFishbot.update(delta);

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
      this.castSparkles.update(rodTip, bobberTip, this.elapsed,
        phase === 'casting' && this.economy.cosmeticEquipped('trail') === 'sparkle-trail');
    } else {
      this.castSparkles.group.visible = false;
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
    this.bottomlessTackleBox.update(delta);
    this.vfx.update(delta);
    this.fishShadows.update(delta);
    this.livingWorld.update(delta);
    this.animateDioramaProps();
    this.communitySystem.update(delta);
    this.narrativeSystem.update(delta);
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
   * Live character preview for the Closet modal: render the portrait set
   * into an offscreen WebGLRenderTarget, read
   * back into a plain 2D <canvas> in the modal — no second WebGL context, no
   * DOM/canvas coordinate-mapping tricks (the target is a fixed small size
   * independent of where the modal panel actually sits on screen).
   */
  private renderClosetPreview(): void {
    const canvas = document.getElementById('closet-preview') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (!canvas.dataset.turnReady) {
      canvas.dataset.turnReady = 'true';
      let dragX = 0;
      let startTurn = 0;
      canvas.addEventListener('pointerdown', (event) => {
        dragX = event.clientX;
        startTurn = this.closetTurn;
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener('pointermove', (event) => {
        if (!canvas.hasPointerCapture(event.pointerId)) return;
        this.closetTurn = startTurn + (event.clientX - dragX) * 0.012;
        this.closetPreviewDirty = true;
      });
      canvas.addEventListener('pointerup', (event) => {
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      });
    }

    const now = performance.now();
    const canvasReplaced = canvas !== this.lastClosetCanvas;
    if (!canvasReplaced && !this.closetPreviewDirty && now - this.lastClosetRenderAt < 250) return;

    const previewDelta = this.lastClosetRenderAt > 0 ? Math.min((now - this.lastClosetRenderAt) / 1000, 0.1) : 0;
    this.lastClosetCanvas = canvas;
    this.closetPreviewDirty = false;
    this.lastClosetRenderAt = now;

    const { width, height } = this.closetPreviewSize;
    const prevClearColor = new THREE.Color();
    this.renderer.getClearColor(prevClearColor);
    const prevClearAlpha = this.renderer.getClearAlpha();

    this.renderer.setRenderTarget(this.closetRenderTarget);
    this.renderer.setClearColor(0xc7e4db, 1);
    this.renderer.clear();
    this.closetCharacter.group.rotation.y = Math.PI + this.closetTurn + Math.sin(this.elapsed * 0.5) * 0.04;
    this.closetCharacter.update(previewDelta);
    this.renderer.render(this.closetScene, this.closetCamera);
    this.renderer.readRenderTargetPixels(this.closetRenderTarget, 0, 0, width, height, this.closetPixelBuffer);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(prevClearColor, prevClearAlpha);

    // WebGL readback is bottom-up; Canvas2D ImageData is top-down.
    const imageData = this.closetImageData && this.closetImageData.width === width && this.closetImageData.height === height
      ? this.closetImageData
      : (this.closetImageData = ctx.createImageData(width, height));
    const rowBytes = width * 4;
    for (let y = 0; y < height; y++) {
      const srcStart = (height - 1 - y) * rowBytes;
      imageData.data.set(this.closetPixelBuffer.subarray(srcStart, srcStart + rowBytes), y * rowBytes);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  private animateDioramaProps(): void {
    const t = this.elapsed;
    for (const cloud of this.diorama.clouds) {
      const baseX = (cloud.userData.baseX as number | undefined) ?? cloud.position.x;
      const baseY = (cloud.userData.baseY as number | undefined) ?? cloud.position.y;
      const phase = (cloud.userData.phase as number | undefined) ?? 0;
      cloud.position.x = baseX + Math.sin(t * 0.14 + phase) * 0.18;
      cloud.position.y = baseY + Math.cos(t * 0.22 + phase) * 0.04;
    }
    for (const pad of this.diorama.lilypads) {
      const baseY = (pad.userData.baseY as number | undefined) ?? pad.position.y;
      const phase = (pad.userData.phase as number | undefined) ?? 0;
      pad.position.y = baseY + Math.sin(t * 1.45 + phase) * 0.014;
      pad.rotation.z = Math.sin(t * 1.1 + phase) * 0.028;
    }
    const glow = this.diorama.root.getObjectByName('dockLanternGlow') as THREE.Mesh | undefined;
    if (glow?.material) {
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.24 + Math.sin(t * 4.2) * 0.06 + Math.cos(t * 7.1) * 0.03;
    }
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
