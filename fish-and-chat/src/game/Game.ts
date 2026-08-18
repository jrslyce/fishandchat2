import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
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
import { loadImportedAsset, normalizedClone, type ImportedAsset } from '../assets/ImportedAssetRegistry';
import { preloadNatureProps } from '../world/NaturePropLibrary';
import { findPath, isWalkable, stepTowardTarget } from '../systems/PlayerNavigation';
import { MODEL_SOURCE_MANIFEST_PUBLIC, SFX_MANIFEST } from '../assets/manifest';
import { CraftingSystem } from '../systems/CraftingSystem';
import { FishbotSystem } from '../systems/FishbotSystem';
import { MuxySystem } from '../systems/MuxySystem';
import { TwitchAuthSystem } from '../systems/TwitchAuthSystem';
import { CloudSaveSystem } from '../systems/CloudSaveSystem';
import { FireflySystem } from '../systems/FireflySystem';
import { MarketSystem } from '../systems/MarketSystem';
import { RenderPipeline } from '../systems/RenderPipeline';
import { ThemeManager } from '../systems/ThemeManager';
import { VfxSystem } from '../systems/VfxSystem';
import { WaterSystem } from '../systems/WaterSystem';
import { THEME_PALETTES } from '../assets/MaterialLibrary';
import { Economy } from './Economy';
import { CASTING_ANIM_SECONDS, FishingStateMachine, type FishingPhase } from './GameState';
import { createDefaultSaveState, type GameSaveStateV1 } from './SaveState';
import { WATER_DISC_RADIUS, type DioramaResult } from '../world/DioramaBuilder';
import type { GameEventMap } from './events';
import { UI } from '../ui/UI';

const AUTOSAVE_INTERVAL_SECONDS = 5;
const WATER_Y = -0.05;
const AMBIENT_FISH_COUNT = 3;
const FISH_TINTS = ['#8fb7c9', '#e0a860', '#7fa876'];
/**
 * Backstop for a commanded walk. findPath only returns routes it has proven
 * walkable, so this should never fire in practice — it exists so a future
 * change that invalidates a route mid-walk (a moved dock, a new obstacle)
 * degrades into "stops walking" rather than "character frozen forever".
 */
const WALK_COMMAND_TIMEOUT_SECONDS = 15;
// How far off the player's own facing a cast can be aimed — clamped so a cast can never
// throw backward over the dock/land, only vary left-right while still landing in the pond.
const CAST_CONE_RADIANS = THREE.MathUtils.degToRad(50);
const CAST_DISTANCE = 1.8;
/**
 * How long a press on land must be held before it walks instead of casting.
 * In the portrait Twitch panel only ~18% of the viewport is water, so letting
 * any land tap walk meant a tap was 2.5x more likely to move the character than
 * to cast — the primary action lost the majority of the screen. Gating walking
 * behind a hold gives every short tap back to casting, wherever it lands.
 */
const WALK_LONG_PRESS_SECONDS = 0.35;

interface AmbientFish {
  group: THREE.Object3D;
  angle: number;
  radius: number;
  speed: number;
  bobPhase: number;
  state: 'swim' | 'jump';
  jumpTimer: number;
  jumpDuration: number;
  jumpStartX: number;
  jumpStartZ: number;
  jumpTargetX: number;
  jumpTargetZ: number;
}

interface LeapingFish {
  group: THREE.Group;
  elapsed: number;
  duration: number;
  startX: number;
  startZ: number;
}

/**
 * Phase 4 wiring: the placeholder box/plane scene from Phase 1/2 is replaced
 * with the authored voxel diorama (VoxelKit + ThemeManager), a shader-based
 * water surface, a lighting/post-processing pipeline, event-driven VFX, and
 * the Phase 3 Tripo GLBs (Barnaby, fishbot, ambient fish, a discarded boot).
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
  private readonly economy: Economy;
  private readonly marketSystem: MarketSystem;
  private readonly craftingSystem: CraftingSystem;
  private readonly fishbotSystem: FishbotSystem;
  private readonly muxySystem: MuxySystem;
  private readonly twitchAuthSystem: TwitchAuthSystem;
  private readonly cloudSave: CloudSaveSystem;
  private readonly fishingState: FishingStateMachine;
  private readonly ui: UI;
  private readonly bobber: Bobber;
  private readonly fishingLine = new FishingLine();
  private readonly water: WaterSystem;
  private readonly themeManager: ThemeManager;
  private readonly renderPipeline: RenderPipeline;
  private readonly vfx: VfxSystem;
  private readonly fireflies: FireflySystem;

  private diorama: DioramaResult;
  private barnabyGroup: THREE.Group | null = null;
  private fishbotGroup: THREE.Group | null = null;
  private fishbotGroup2: THREE.Group | null = null;
  private fishbotStandbyLight: THREE.Mesh | null = null;
  private genericFishAsset: ImportedAsset | null = null;
  private prismKoiAsset: ImportedAsset | null = null;
  private readonly ambientFish: AmbientFish[] = [];
  private readonly leapingFish: LeapingFish[] = [];

  // Barnaby is a stationary stallkeeper: he idles in place and never wanders.
  // The portrait/mobile Twitch panel frames only a narrow slice of the bank, so
  // a wandering vendor spent most of his time off-frame — and when he was in
  // frame he pulled the eye away from the bobber, which is the only thing the
  // player is actually watching. See git history for the removed walk loop.
  private barnabyMixer: THREE.AnimationMixer | null = null;
  private barnabyIdleAction: THREE.AnimationAction | null = null;

  private readonly playerCharacter = new PlayerCharacter();
  private playerIsWalking = false;
  private playerWalkTimer = 2 + Math.random() * 2;
  private playerTargetLocal = new THREE.Vector3();
  private playerFishingActive = false;
  /** Remaining WORLD-space waypoints of a commanded walk; empty when the idle wander owns the character. */
  private playerWalkRoute: THREE.Vector3[] = [];
  private playerWalkTimeout = 0;
  /**
   * A press on non-water that hasn't resolved into either a cast or a walk yet.
   * Water presses cast on the press edge as before (an aimed cast should feel
   * instant); everywhere else the press edge is swallowed and held here until
   * the pointer either lifts (short = cast) or crosses
   * WALK_LONG_PRESS_SECONDS (long = walk, when the spot is walkable).
   */
  private pendingTap: { walkTarget: THREE.Vector3 | null; heldSeconds: number } | null = null;
  /**
   * Slot-local anchor the idle shuffle stays near. Without an anchor the
   * shuffle is an unbounded random walk and the character drifts off across the
   * island over a few minutes of idling; it moves only when a commanded walk
   * finishes somewhere new.
   */
  private playerWanderHomeLocal = new THREE.Vector3();
  private readonly defaultCameraFocus = new THREE.Vector3(0, 0.3, 0.5);

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
    this.cameraRig = new CameraRig(this.camera, new THREE.Vector3(0, 6.5, 9));
    this.cameraRig.focusOn(this.defaultCameraFocus);
    // Render targets default to a linear working color space (the sRGB
    // output transform normally only happens on the final canvas blit) — the
    // closet preview reads pixels straight back out, so it needs the target
    // itself to hold sRGB-encoded values or it comes out looking too dark.
    this.closetRenderTarget.texture.colorSpace = THREE.SRGBColorSpace;

    // The whole canvas is the action surface (tap anywhere to cast/reel) — `#ui-root` sits on
    // top with `pointer-events: none` except on its own buttons, so real HUD/modal clicks never
    // reach here and won't double-fire a cast.
    const actionSurface = this.getElement('#game-canvas');
    this.input = new InputController(actionSurface);

    this.economy = new Economy(this.saveManager);
    Object.assign(this.audio.mix, this.economy.snapshot.audio);
    this.marketSystem = new MarketSystem(this.economy, this.events);
    this.craftingSystem = new CraftingSystem(this.economy, this.events);
    this.fishbotSystem = new FishbotSystem(this.economy, this.events);
    this.muxySystem = new MuxySystem(this.craftingSystem);
    void this.muxySystem.init();
    this.twitchAuthSystem = new TwitchAuthSystem(this.events);
    void this.twitchAuthSystem.init();
    this.cloudSave = new CloudSaveSystem(this.economy, this.events);
    // A pulled save replaces everything at once, so re-derive what was built from the
    // old one rather than waiting for the per-field events that never fired.
    this.events.on('cloudSaveAdopted', () => {
      void this.refreshPlayerSkin();
      this.playerCharacter.setName(this.economy.displayName());
      this.events.emit('coinsChanged', {});
    });
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
    this.water = new WaterSystem(WATER_DISC_RADIUS, initialPalette.waterShallow, initialPalette.waterDeep);
    this.water.mesh.position.y = WATER_Y;
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
      // Freeze a clean, camera-facing pose for the preview: reset the
      // wander offset/rotation the idle loop may have left it in, so the
      // total facing/position is just the slot's own fixed anchor.
      this.playerCharacter.group.position.set(0, 0, 0);
      this.playerCharacter.group.rotation.y = 0;
      this.playerIsWalking = false;
      this.playerCharacter.setPose('idle');
      this.cameraRig.focusOn(this.diorama.playerSlot.position);
    });
    this.events.on('closetClosed', () => {
      this.closetOpen = false;
      this.cameraRig.focusOn(this.defaultCameraFocus);
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
      getBobberPosition: () => this.bobber.group.position,
      getBarnabyPosition: () => this.diorama.barnabySlot.position,
      getCraftingBenchPosition: () => new THREE.Vector3(-3.6, 0.7, -1.6),
    });
    this.fireflies = new FireflySystem(this.scene);

    this.events.on('themeChanged', ({ theme }) => void this.themeManager.setTheme(theme));
    this.events.on('catchResolved', ({ result }) => {
      if (!result.isTrash) this.spawnFishLeap(result.rarity === 'legendary');
    });

    if (import.meta.env.DEV) {
      (window as unknown as { __game_scene?: THREE.Scene }).__game_scene = this.scene;
      // Sibling of __game_scene: reaching the live instance is what makes input
      // routing (which click became a walk, which became a cast) debuggable.
      (window as unknown as { __game?: Game }).__game = this;
    }

    this.wireAudioTriggers();
    this.loadHeroAssets();
    this.loadNatureProps();
    this.fishbotSystem.simulateOfflineProgress(this.economy.currentTheme());
    window.addEventListener('pagehide', this.onPageHide);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    // RenderPipeline's EffectComposer is constructed above at whatever pixel ratio/size
    // the renderer had at that point (default 1x) — resizeRenderer() alone corrects the
    // renderer's own output resolution but never touches the composer's render targets,
    // so bloom/vignette silently kept compositing at 1x and got upscaled onto the real
    // (often 2x/3x retina) canvas ever since. This is why the whole game reads as blurry:
    // every frame passes through that under-resolved composer. Mirror the per-frame
    // resize-then-composer-resize pairing here too so the very first frame is sharp.
    resizeRenderer(this.renderer, this.camera);
    this.renderPipeline.resize(this.canvas.clientWidth, this.canvas.clientHeight);
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
    this.events.on('marketSold', ({ method }) => {
      if (method !== 'sell') void this.audio.playSfx(SFX_MANIFEST.haggleBones, 0.7);
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
      if (ok) {
        this.updateFishbotVisibility();
        this.updateFishbotGlow();
      }
    });
    this.events.on('fishbotEquipped', () => {
      this.updateFishbotVisibility();
      this.updateFishbotGlow();
    });
    this.events.on('fishbotClaimed', () => void this.audio.playSfx(SFX_MANIFEST.catchJingle, 0.8));
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
    this.fireflies.dispose();
    this.cloudSave.dispose();
    this.renderPipeline.dispose();
    this.economy.persist();
    this.events.clear();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
  }

  private onDioramaRebuilt(diorama: DioramaResult): void {
    this.diorama = diorama;
    if (this.barnabyGroup) diorama.barnabySlot.add(this.barnabyGroup);
    if (this.fishbotGroup) diorama.fishbotSlot.add(this.fishbotGroup);
    if (this.fishbotGroup2) diorama.fishbotSlot.add(this.fishbotGroup2);
    diorama.playerSlot.add(this.playerCharacter.group);
    this.updateFishbotVisibility();
  }

  private async refreshPlayerSkin(): Promise<void> {
    await this.playerCharacter.refreshSkin(this.economy.baseTone(), this.economy.equippedClothing());
  }

  /** Keeps the player character's pose in sync with the real fishing state machine, not just decorative. */
  private onFishingPhaseChanged(phase: FishingPhase): void {
    switch (phase) {
      case 'aiming':
      case 'casting':
      case 'waiting':
      case 'bite':
        this.playerFishingActive = true;
        // Casting roots the character — drop any walk still in progress rather
        // than letting it fight the fishing pose for the transform.
        this.playerWalkRoute = [];
        this.playerCharacter.setPose('fishing');
        this.playerCharacter.setFishingSubPose(phase);
        if (phase === 'casting') this.throwBobber();
        break;
      case 'celebrating':
        this.playerFishingActive = false;
        this.playerCharacter.setPose('wave');
        break;
      default:
        // idle / resolving / missed: hand control back to the wander loop.
        this.playerFishingActive = false;
        break;
    }
  }

  /**
   * Throws the bobber toward wherever the player is currently facing, clamped to a cone
   * around the dock's water-facing direction so a cast can never aim backward onto land —
   * the wander loop leaves the character facing an arbitrary direction once fishing starts
   * (Game.ts's updatePlayerCharacter freezes it), so an unclamped throw could otherwise aim
   * at the dock or grass instead of the pond.
   */
  /** Builds a picking ray from a pointer event in canvas coordinates. */
  private raycasterFromPointer(event: PointerEvent): THREE.Raycaster {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    return raycaster;
  }

  /**
   * What the player meant by clicking here: cast into the water, walk to a spot
   * on land, or nothing at all.
   *
   * 'none' covers the sky, the water beyond the pond disc, and scenery standing
   * somewhere the character can't reach. Those deliberately do NOT fall through
   * to a cast — casting is a water-click gesture now, so a stray click on the
   * horizon should be inert rather than flinging the bobber out on the fallback
   * cone. Walk tests use the hit point's XZ, so clicking high up a tree walks to
   * the tree's base instead of refusing the click.
   */
  private classifyPointer(event: PointerEvent): { kind: 'water' | 'land' | 'none'; point?: THREE.Vector3 } {
    const raycaster = this.raycasterFromPointer(event);
    const hits = raycaster.intersectObjects([this.water.mesh, this.diorama.root], true);
    if (hits.length === 0) return { kind: 'none' };

    const hit = hits[0];
    if (hit.object === this.water.mesh) return { kind: 'water', point: hit.point.clone() };
    if (!isWalkable(hit.point.x, hit.point.z)) return { kind: 'none' };
    return { kind: 'land', point: hit.point.clone() };
  }

  private throwBobber(): void {
    const playerWorldPos = new THREE.Vector3();
    this.playerCharacter.group.getWorldPosition(playerWorldPos);
    const startPos = this.playerCharacter.getRodTipWorldPosition(new THREE.Vector3());

    let landingPos: THREE.Vector3 | null = null;
    
    if (this.input.lastClickEvent) {
      const e = this.input.lastClickEvent;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
      const intersects = raycaster.intersectObjects([this.water.mesh, this.diorama.root], true);
      if (intersects.length > 0 && intersects[0].object === this.water.mesh) {
        landingPos = intersects[0].point;
      }
    }
    
    if (!landingPos) {
      const slotForward = new THREE.Vector3();
      this.diorama.playerSlot.getWorldDirection(slotForward);
      
      const randomAngle = (Math.random() * 2 - 1) * CAST_CONE_RADIANS;
      const castDir = slotForward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), randomAngle);
      castDir.y = 0;
      castDir.normalize();
      
      const randomDist = CAST_DISTANCE * (0.6 + Math.random() * 0.6);
      landingPos = playerWorldPos.clone().addScaledVector(castDir, randomDist);
    }
    
    landingPos.y = WATER_Y;

    this.bobber.throwTo(startPos, landingPos, CASTING_ANIM_SECONDS);
  }

  /**
   * The imported nature-prop pack (trees/rocks/grass) can only be consumed by
   * the synchronous DioramaBuilder once it's resident, so the first diorama is
   * always built from procedural VoxelKit props and swapped here when the pack
   * lands. onDioramaRebuilt re-attaches Barnaby/fishbot/player, so this is safe
   * to run whether or not loadHeroAssets has finished.
   */
  private async loadNatureProps(): Promise<void> {
    if (await preloadNatureProps()) this.themeManager.rebuildProps();
  }

  private async loadHeroAssets(): Promise<void> {
    const [barnaby, fishbot, fishbotMk2, genericFish, prismKoi, oldBoot, bobberAsset] = await Promise.allSettled([
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.barnaby),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.fishbot),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.fishbotMk2),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.genericFish),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.prismKoi),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.oldBoot),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.bobber),
    ]);

    if (barnaby.status === 'fulfilled') {
      const fbxLoader = new FBXLoader();
      try {
        const idleFbx = await fbxLoader.loadAsync('./models/barnaby-anim/idle.fbx');

        idleFbx.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach(mat => {
                const phongMat = mat as THREE.MeshPhongMaterial;
                if (phongMat.isMeshPhongMaterial) {
                  phongMat.shininess = 0;
                  phongMat.specular.setHex(0x000000);
                }
              });
            }
          }
        });

        const bounds = new THREE.Box3().setFromObject(idleFbx);
        const size = new THREE.Vector3();
        bounds.getSize(size);
        const scale = size.y > 0 ? 1.1 / size.y : 1;

        const center = new THREE.Vector3();
        bounds.getCenter(center);
        
        idleFbx.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        idleFbx.scale.setScalar(scale);

        const wrapper = new THREE.Group();
        wrapper.add(idleFbx);

        this.barnabyGroup = wrapper;
        this.diorama.barnabySlot.add(this.barnabyGroup);

        this.barnabyMixer = new THREE.AnimationMixer(idleFbx);
        
        const stripHorizontalMovement = (clip: THREE.AnimationClip) => {
          clip.tracks.forEach((track) => {
            if (track.name.endsWith('.position')) {
              const values = track.values;
              for (let i = 0; i < values.length; i += 3) {
                values[i] = 0;     // X
                values[i + 2] = 0; // Z
              }
            }
          });
          return clip;
        };

        const idleClip = stripHorizontalMovement(idleFbx.animations[0]);

        this.barnabyIdleAction = this.barnabyMixer.clipAction(idleClip);
        this.barnabyIdleAction.play();
      } catch (e) {
        console.warn("Failed to load FBX, falling back to static", e);
        this.barnabyGroup = normalizedClone(barnaby.value, 1.1);
        this.diorama.barnabySlot.add(this.barnabyGroup);
      }
    }
    if (fishbot.status === 'fulfilled') {
      this.fishbotGroup = normalizedClone(fishbot.value, 0.6);
      this.diorama.fishbotSlot.add(this.fishbotGroup);
      this.updateFishbotVisibility();
    }
    if (fishbotMk2.status === 'fulfilled') {
      this.fishbotGroup2 = normalizedClone(fishbotMk2.value, 0.6);
      this.diorama.fishbotSlot.add(this.fishbotGroup2);

      // Small standby LED on top, shown only while Mk II is equipped but idle (not
      // auto-fishing) — the "full" glow (boosting the model's own baked-in cyan
      // highlights) only kicks in once auto-fishing is toggled on.
      const bounds = new THREE.Box3().setFromObject(this.fishbotGroup2);
      const center = new THREE.Vector3();
      bounds.getCenter(center);
      this.fishbotStandbyLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x33ff55, emissiveIntensity: 1.5 }),
      );
      this.fishbotStandbyLight.position.set(center.x, bounds.max.y + 0.012, center.z);
      this.fishbotGroup2.add(this.fishbotStandbyLight);

      this.updateFishbotVisibility();
      this.updateFishbotGlow();
    }
    if (genericFish.status === 'fulfilled') {
      this.genericFishAsset = genericFish.value;
      this.spawnAmbientFish();
    }
    if (prismKoi.status === 'fulfilled') {
      this.prismKoiAsset = prismKoi.value;
    }
    if (oldBoot.status === 'fulfilled') {
      const boot = normalizedClone(oldBoot.value, 0.22);
      boot.position.set(2.1, 0.02, 2.5);
      boot.rotation.y = 0.6;
      this.scene.add(boot);
    }
    if (bobberAsset.status === 'fulfilled') {
      this.bobber.setModel(normalizedClone(bobberAsset.value, 0.22));
    }
  }

  private spawnAmbientFish(): void {
    if (!this.genericFishAsset) return;
    for (let i = 0; i < AMBIENT_FISH_COUNT; i++) {
      const group = normalizedClone(this.genericFishAsset, 0.22 + Math.random() * 0.08);
      this.tintModel(group, FISH_TINTS[i % FISH_TINTS.length]);
      // Underwater ambience: shadow participation just turns them into black
      // blobs beneath the terrain-shadowed pond surface.
      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        }
      });
      this.scene.add(group);
      this.ambientFish.push({
        group,
        angle: (i / AMBIENT_FISH_COUNT) * Math.PI * 2,
        radius: 0.8 + Math.random() * 1.2,
        speed: 0.25 + Math.random() * 0.15,
        bobPhase: Math.random() * Math.PI * 2,
        state: 'swim',
        jumpTimer: -Math.random() * 20,
        jumpDuration: 0,
        jumpStartX: 0,
        jumpStartZ: 0,
        jumpTargetX: 0,
        jumpTargetZ: 0,
      });
    }
  }

  private tintModel(root: THREE.Object3D, hex: string): void {
    const color = new THREE.Color(hex);
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = mats.map((mat) => {
        const cloned = (mat as THREE.MeshStandardMaterial).clone();
        cloned.color = color.clone();
        // Marks this clone as owned by its model instance (not shared with
        // the cached asset), so short-lived spawns can safely dispose it.
        cloned.userData.ownedClone = true;
        return cloned;
      })[0];
    });
  }

  /** Disposes only the tint-clone materials created by tintModel; shared asset materials are left alone. */
  private disposeOwnedMaterials(root: THREE.Object3D): void {
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat.userData.ownedClone) mat.dispose();
      }
    });
  }

  private spawnFishLeap(legendary: boolean): void {
    const asset = legendary && this.prismKoiAsset ? this.prismKoiAsset : this.genericFishAsset;
    if (!asset) return;
    const group = normalizedClone(asset, legendary ? 0.4 : 0.24);
    if (!legendary) this.tintModel(group, FISH_TINTS[Math.floor(Math.random() * FISH_TINTS.length)]);
    const startX = (Math.random() - 0.5) * 1.6;
    const startZ = (Math.random() - 0.5) * 1.6;
    group.position.set(startX, WATER_Y, startZ);
    this.scene.add(group);
    this.leapingFish.push({ group, elapsed: 0, duration: 0.9, startX, startZ });
    this.water.emitRipple(startX, startZ);
  }

  private updateFishbotGlow(): void {
    const isAuto = this.fishingState.autoFishingEnabled;
    const equippedId = this.economy.equippedFishbotId();

    // Mk I: the original blanket full-body green tint.
    if (this.fishbotGroup) {
      const targetEmissive = equippedId === 'fishbot-mk1' && isAuto ? 0x66ff66 : 0x000000;
      this.fishbotGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (!child.userData.originalMaterial) child.userData.originalMaterial = child.material;
          child.material = child.userData.originalMaterial.clone();
          child.material.emissive.setHex(targetEmissive);
          child.material.emissiveIntensity = targetEmissive ? 0.8 : 0;
        }
      });
    }

    // Mk II: no blanket tint. When active, reuse its own baked-in color texture as
    // an emissive map — the already-bright/cyan-painted panels (scope, antenna,
    // hover lights) glow on their own, everything else (dark gunmetal) stays dark.
    // When idle, drop the boosted glow and show a small standby LED on top instead.
    if (this.fishbotGroup2) {
      const active = equippedId === 'fishbot-mk2' && isAuto;
      this.fishbotGroup2.traverse((child) => {
        if (child === this.fishbotStandbyLight) return;
        if (child instanceof THREE.Mesh) {
          if (!child.userData.originalMaterial) child.userData.originalMaterial = child.material;
          child.material = child.userData.originalMaterial.clone();
          if (active) {
            child.material.emissiveMap = child.material.map;
            child.material.emissive.setHex(0xffffff);
            child.material.emissiveIntensity = 1.4;
          } else {
            child.material.emissiveMap = null;
            child.material.emissive.setHex(0x000000);
            child.material.emissiveIntensity = 0;
          }
        }
      });
      if (this.fishbotStandbyLight) this.fishbotStandbyLight.visible = equippedId === 'fishbot-mk2' && !isAuto;
    }
  }

  private updateFishbotVisibility(): void {
    const equippedId = this.economy.equippedFishbotId();
    if (this.fishbotGroup) this.fishbotGroup.visible = equippedId === 'fishbot-mk1';
    if (this.fishbotGroup2) this.fishbotGroup2.visible = equippedId === 'fishbot-mk2';
  }

  /**
   * Wanders the player character around their own patch of bank when no
   * real fishing action is in progress; hands off to onFishingPhaseChanged's
   * pose control (fishing/wave) otherwise. Pattern-matches Barnaby's
   * hand-rolled walk-to-target loop, simplified since the player's slot
   * already sits in a small pre-cleared exclusion zone (no bank-radius
   * checks needed).
   */
  /**
   * Drives one frame of a click-commanded walk.
   *
   * The character is parented to the diorama's playerSlot, but walkability is
   * defined in world space (the pond is at the world origin), so this converts
   * out and back each frame rather than trying to express the pond in slot-local
   * terms — the slot is rotated 180 degrees, which would make that error-prone.
   */
  /**
   * Resolves a deferred non-water press into either a walk or a cast.
   *
   * Held past WALK_LONG_PRESS_SECONDS on walkable ground: walk there. Released
   * before that: a plain tap, so cast — which is what hands casting the entire
   * canvas, including the ~38% of the portrait frame that raycasts to neither
   * water nor standable ground. Held long on ground that can't be stood on does
   * neither; holding still is the one gesture that shouldn't fling a bobber.
   */
  private updatePendingTap(delta: number): void {
    const pending = this.pendingTap;
    if (!pending) return;

    // Anything that takes control away mid-gesture voids it rather than letting
    // a stale press resolve into a cast on top of whatever now owns the screen.
    if (this.closetOpen || this.playerFishingActive) {
      this.pendingTap = null;
      return;
    }

    if (this.input.isHeld()) {
      pending.heldSeconds += delta;
      if (pending.heldSeconds >= WALK_LONG_PRESS_SECONDS) {
        this.pendingTap = null;
        if (pending.walkTarget) {
          const from = this.playerCharacter.group.getWorldPosition(new THREE.Vector3());
          this.playerWalkRoute = findPath(from, pending.walkTarget);
          this.playerWalkTimeout = WALK_COMMAND_TIMEOUT_SECONDS;
          this.playerIsWalking = false;
        }
      }
      return;
    }

    this.pendingTap = null;
    this.fishingState.requestCast();
  }

  private walkTowardCommandedTarget(delta: number): void {
    const waypoint = this.playerWalkRoute[0];
    if (!waypoint) return;

    this.playerWalkTimeout -= delta;
    const slot = this.diorama.playerSlot;
    const group = this.playerCharacter.group;
    slot.updateWorldMatrix(true, false);

    const worldPosition = group.getWorldPosition(new THREE.Vector3());
    const step = stepTowardTarget(worldPosition, waypoint, delta);

    if (step.arrived && this.playerWalkRoute.length > 1) {
      // Reached an intermediate waypoint; carry on along the path next frame.
      this.playerWalkRoute.shift();
      return;
    }

    if (step.arrived || this.playerWalkTimeout <= 0) {
      // Hand back to the wander loop, but idle for a beat first so arriving
      // doesn't immediately snap into an unrelated wander. Wherever we stopped
      // is the new home the shuffle stays near.
      this.playerWalkRoute = [];
      this.playerIsWalking = false;
      this.playerWalkTimer = 2 + Math.random() * 3;
      this.playerWanderHomeLocal.copy(group.position);
      this.playerCharacter.setPose('idle');
      return;
    }

    group.position.copy(slot.worldToLocal(step.position));
    if (step.heading !== null) {
      // step.heading is a world yaw; the slot's own rotation has to come back
      // out of it before it can be applied to the character's local transform.
      const slotYaw = new THREE.Euler().setFromQuaternion(
        slot.getWorldQuaternion(new THREE.Quaternion()),
        'YXZ',
      ).y;
      const targetAngle = step.heading - slotYaw;
      const diff = ((targetAngle - group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      group.rotation.y += diff * 8 * delta;
    }
    this.playerCharacter.setPose('walking');
  }

  private updatePlayerCharacter(delta: number): void {
    if (this.closetOpen) {
      // Frozen for the live preview — still advance the idle animation clock
      // (so it doesn't look like a paused screenshot) but skip wander/pose
      // changes entirely.
      this.playerCharacter.update(delta);
      return;
    }

    if (this.playerWalkRoute.length > 0 && !this.playerFishingActive) {
      this.walkTowardCommandedTarget(delta);
      this.playerCharacter.update(delta);
      return;
    }

    if (!this.playerFishingActive) {
      this.playerWalkTimer -= delta;
      if (this.playerWalkTimer <= 0) {
        this.playerIsWalking = !this.playerIsWalking;
        this.playerWalkTimer = this.playerIsWalking ? 2.5 + Math.random() * 2 : 2 + Math.random() * 3;

        if (this.playerIsWalking) {
          // The idle shuffle is no longer always on the dock now that clicks can
          // walk the character onto the bank, so it samples an offset from its
          // current home and keeps the first one that's actually standable —
          // reusing PlayerNavigation's test rather than a hardcoded rectangle,
          // so the two can't disagree about where the planks end.
          const slot = this.diorama.playerSlot;
          slot.updateWorldMatrix(true, false);
          for (let attempt = 0; attempt < 8; attempt++) {
            const candidateLocal = new THREE.Vector3(
              this.playerWanderHomeLocal.x + (Math.random() - 0.5) * 0.6,
              0,
              this.playerWanderHomeLocal.z + (Math.random() - 0.5) * 0.6,
            );
            const world = slot.localToWorld(candidateLocal.clone());
            if (isWalkable(world.x, world.z)) {
              this.playerTargetLocal.copy(candidateLocal);
              break;
            }
            // Every offset blocked (backed into a corner): stay put this cycle.
            if (attempt === 7) this.playerIsWalking = false;
          }
        }
      }

      const group = this.playerCharacter.group;
      if (this.playerIsWalking) {
        const dist = group.position.distanceTo(this.playerTargetLocal);
        if (dist > 0.05) {
          const dir = new THREE.Vector3().subVectors(this.playerTargetLocal, group.position).normalize();
          group.position.addScaledVector(dir, 0.25 * delta);
          const targetAngle = Math.atan2(dir.x, dir.z);
          const diff = ((targetAngle - group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          group.rotation.y += diff * 5 * delta;
          this.playerCharacter.setPose('walking');
        } else {
          this.playerWalkTimer = 0;
          this.playerCharacter.setPose('idle');
        }
      } else {
        this.playerCharacter.setPose('idle');
      }
    }

    this.playerCharacter.update(delta);
  }

  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    this.elapsed = elapsed;

    // composer.setSize() reallocates every post-processing render target (bloom's mip
    // chain, vignette pass) — only pay that cost when the canvas actually changed size.
    if (resizeRenderer(this.renderer, this.camera)) {
      this.renderPipeline.resize(this.canvas.clientWidth, this.canvas.clientHeight);
    }

    const visibleFishbotGroups = [this.fishbotGroup, this.fishbotGroup2].filter(
      (group): group is THREE.Group => !!group && group.visible,
    );
    if (this.input.justPressed() && this.input.lastClickEvent && visibleFishbotGroups.length > 0) {
      if (this.fishingState.autoFishingEnabled) {
        this.fishingState.autoFishingEnabled = false;
        this.input.consumePress();
        this.updateFishbotGlow();
        this.events.emit('fishbotToggled', { enabled: false, name: '' });
      } else {
        const e = this.input.lastClickEvent;
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
        const intersects = raycaster.intersectObjects(visibleFishbotGroups, true);
        if (intersects.length > 0) {
          this.fishingState.autoFishingEnabled = true;
          this.input.consumePress();
          this.updateFishbotGlow();

          const equippedId = this.economy.equippedFishbotId();
          const botName = (equippedId && this.economy.fishbotDefinition(equippedId)?.name) ?? 'Fishbot';
          this.events.emit('fishbotToggled', { enabled: true, name: botName });
        }
      }
    }

    // Land clicks walk, water clicks cast, everything else is inert. This has to
    // sit ahead of fishingState.update — that's what turns a press into a cast,
    // so anything that isn't a cast must consume the press before it gets there.
    //
    // Only while idle, and only for pointer input: during aiming/waiting/bite
    // the press is the player's reaction input and stealing it would break the
    // core loop, and Space/Enter (which carry no click position) must keep
    // casting unconditionally.
    if (this.input.justPressed() && this.input.lastClickEvent && !this.playerFishingActive && !this.closetOpen) {
      const pick = this.classifyPointer(this.input.lastClickEvent);
      if (pick.kind !== 'water') {
        // Not water: defer. Swallow the press edge so it can't cast yet, and
        // remember whether this spot is somewhere the character could stand.
        this.pendingTap = { walkTarget: pick.kind === 'land' ? pick.point ?? null : null, heldSeconds: 0 };
        this.input.consumePressEdge();
      }
    }
    this.updatePendingTap(delta);

    if (this.input.justPressed()) this.events.emit('actionPressed', {});
    this.fishingState.update(delta, this.input);
    if (this.input.justReleased()) this.events.emit('actionReleased', { heldSeconds: this.input.lastHoldSeconds() });
    this.input.update();

    this.fishbotSystem.update(Date.now(), this.economy.currentTheme());
    this.updateFishbotVisibility();

    // ThemeManager's constructor-time playAmbience() is a silent no-op (the
    // AudioContext only exists after the first user gesture), so kick the
    // current theme's ambience once the engine actually unlocks.
    if (!this.ambienceStarted && this.audio.isUnlocked()) {
      this.ambienceStarted = true;
      this.themeManager.playCurrentAmbience();
    }

    const phase = this.fishingState.getPhase();
    this.bobber.setVisible(phase === 'casting' || phase === 'waiting' || phase === 'bite' || phase === 'celebrating');
    this.bobber.update(delta, phase);

    const lineTaut = phase === 'casting' || phase === 'waiting' || phase === 'bite';
    this.fishingLine.setVisible(lineTaut);
    if (lineTaut) {
      const rodTip = this.playerCharacter.getRodTipWorldPosition(new THREE.Vector3());
      this.fishingLine.update(rodTip, this.bobber.group.position);
    }
    if (phase === 'waiting') {
      // Timer-based cadence: one ripple every 2s. (A floor(elapsed)%N check
      // is true for a whole 0.5s window each cycle — ~30 emits per window.)
      this.rippleTimer -= delta;
      if (this.rippleTimer <= 0) {
        this.rippleTimer = 2;
        this.water.emitRipple(this.bobber.group.position.x, this.bobber.group.position.z);
      }
    } else {
      this.rippleTimer = 0;
    }

    this.water.update(delta);
    this.updateAmbientFish(delta);
    this.updateLeapingFish(delta);
    this.updateLilypads(delta);
    this.updateClouds(delta);

    this.barnabyMixer?.update(delta);

    this.updatePlayerCharacter(delta);

    this.vfx.update(delta);
    this.fireflies.update(elapsed);
    this.cloudSave.update(delta);
    this.ui.update();
    this.cameraRig.update(delta);

    this.saveTimer += delta;
    if (this.saveTimer >= AUTOSAVE_INTERVAL_SECONDS) {
      this.saveTimer = 0;
      this.economy.persist();
    }

    this.publishDiagnostics();
  }

  private updateAmbientFish(delta: number): void {
    for (const fish of this.ambientFish) {
      if (fish.state === 'jump') {
        fish.jumpTimer += delta;
        fish.angle += fish.speed * delta;
        
        const t = Math.min(1, fish.jumpTimer / fish.jumpDuration);
        const arc = Math.sin(t * Math.PI);
        const y = WATER_Y - 0.05 + arc * 1.0; 
        
        const x = THREE.MathUtils.lerp(fish.jumpStartX, fish.jumpTargetX, t);
        const z = THREE.MathUtils.lerp(fish.jumpStartZ, fish.jumpTargetZ, t);
        
        fish.group.position.set(x, y, z);
        
        const dx = fish.jumpTargetX - fish.jumpStartX;
        const dz = fish.jumpTargetZ - fish.jumpStartZ;
        const rotY = Math.atan2(dx, dz) - Math.PI / 2;
        fish.group.rotation.set(-arc * 0.8, rotY, 0); 
        
        if (t >= 1) {
          fish.state = 'swim';
          fish.jumpTimer = -Math.random() * 20 - 5; 
          this.water.emitRipple(fish.jumpTargetX, fish.jumpTargetZ);
          fish.group.rotation.set(0, rotY, 0);
        }
        continue;
      }
      
      fish.angle += fish.speed * delta;
      
      const currentRadius = fish.radius + Math.sin(fish.angle * 1.5 + fish.bobPhase) * 0.4;
      const x = Math.cos(fish.angle) * currentRadius;
      const z = Math.sin(fish.angle) * currentRadius * 0.7;
      
      const dx = x - fish.group.position.x;
      const dz = z - fish.group.position.z;
      
      fish.group.position.set(x, WATER_Y - 0.05 + Math.sin(this.elapsed * 2 + fish.bobPhase) * 0.02, z);
      
      if (dx !== 0 || dz !== 0) {
        let baseRot = Math.atan2(dx, dz) + Math.PI;
        const wiggle = Math.sin(this.elapsed * 12 + fish.bobPhase) * 0.15;
        
        let currentRot = fish.group.rotation.y;
        const prevWiggle = Math.sin((this.elapsed - delta) * 12 + fish.bobPhase) * 0.15;
        currentRot -= prevWiggle;

        const diff = ((baseRot - currentRot + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        currentRot += diff * 10 * delta; 
        
        fish.group.rotation.y = currentRot + wiggle;
      }
      
      fish.jumpTimer += delta;
      if (fish.jumpTimer > 10 && Math.random() < 0.002) {
        fish.state = 'jump';
        fish.jumpTimer = 0;
        fish.jumpDuration = 1.0 + Math.random() * 0.5;
        fish.jumpStartX = x;
        fish.jumpStartZ = z;
        
        const futureAngle = fish.angle + fish.speed * fish.jumpDuration;
        const futureRadius = fish.radius + Math.sin(futureAngle * 1.5 + fish.bobPhase) * 0.4;
        fish.jumpTargetX = Math.cos(futureAngle) * futureRadius;
        fish.jumpTargetZ = Math.sin(futureAngle) * futureRadius * 0.7;
        
        this.water.emitRipple(x, z);
      }
    }
  }

  private updateLeapingFish(delta: number): void {
    for (let i = this.leapingFish.length - 1; i >= 0; i--) {
      const leap = this.leapingFish[i];
      leap.elapsed += delta;
      const t = Math.min(1, leap.elapsed / leap.duration);
      const arc = Math.sin(t * Math.PI);
      leap.group.position.y = WATER_Y + arc * 0.7;
      leap.group.position.x = leap.startX + t * 0.3;
      leap.group.rotation.x = -arc * 0.6;
      if (t >= 1) {
        this.scene.remove(leap.group);
        // Non-legendary leaps carry per-leap tinted material clones; without
        // this, every catch leaks a material.
        this.disposeOwnedMaterials(leap.group);
        this.leapingFish.splice(i, 1);
      }
    }
  }

  private updateLilypads(delta: number): void {
    for (const lilypad of this.diorama.lilypads) {
      lilypad.position.y = WATER_Y + 0.02 + Math.sin(this.elapsed * 0.8 + lilypad.position.x * 2) * 0.01;
    }
    void delta;
  }

  private updateClouds(delta: number): void {
    for (const cloud of this.diorama.clouds) {
      cloud.position.x += delta * 0.08;
      if (cloud.position.x > 10) cloud.position.x = -10;
    }
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
