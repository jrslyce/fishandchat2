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
import {
  ANGLER_SEAT,
  ANGLER_WATER_FOCUS,
  WATER_DISC_RADIUS,
  type DioramaResult,
} from '../world/DioramaBuilder';
import type { GameEventMap } from './events';
import { UI } from '../ui/UI';

const AUTOSAVE_INTERVAL_SECONDS = 5;
const WATER_Y = -0.05;
/** The pond surface as a maths plane — what clicks are resolved against when aiming a cast. */
const WATER_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y);
const AMBIENT_FISH_COUNT = 3;
const FISH_TINTS = ['#8fb7c9', '#e0a860', '#7fa876'];
// How far off the player's own facing a cast can be aimed — clamped so a cast can never
// throw backward over the bank, only vary left-right while still landing in the pond.
// Only the fallback (a click that missed the water entirely) uses this; a click on the
// pond casts exactly where it landed.
const CAST_CONE_RADIANS = THREE.MathUtils.degToRad(50);
const CAST_DISTANCE = 1.8;
/**
 * Clicks are clamped inside this radius rather than the water disc's own, so a cast aimed
 * at the very rim still lands on water the shader actually draws (the disc is a square
 * plane that discards outside an inscribed circle — its corners raycast but are invisible).
 */
const CAST_MAX_RADIUS = WATER_DISC_RADIUS - 0.25;
/** Keeps a click right at the angler's feet from dropping the bobber on top of them. */
const CAST_MIN_DISTANCE = 0.7;

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
  private readonly fishingState: FishingStateMachine;
  private readonly ui: UI;
  private readonly bobber: Bobber;
  private readonly fishingLine = new FishingLine();
  private readonly water: WaterSystem;
  private readonly themeManager: ThemeManager;
  private readonly renderPipeline: RenderPipeline;
  private readonly vfx: VfxSystem;

  private diorama: DioramaResult;
  private barnabyGroup: THREE.Group | null = null;
  private fishbotGroup: THREE.Group | null = null;
  private genericFishAsset: ImportedAsset | null = null;
  private prismKoiAsset: ImportedAsset | null = null;
  private readonly ambientFish: AmbientFish[] = [];
  private readonly leapingFish: LeapingFish[] = [];

  private barnabyMixer: THREE.AnimationMixer | null = null;
  private barnabyIdleAction: THREE.AnimationAction | null = null;
  private barnabyWalkAction: THREE.AnimationAction | null = null;
  private barnabyIsWalking = false;
  private barnabyWalkTimer = 2;
  private barnabyTargetPos: THREE.Vector3 | null = null;

  private readonly playerCharacter = new PlayerCharacter();

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
    // Fixed over-the-shoulder shot: the rig derives the camera from the
    // angler's seat and the water they face, with the shoulder offset sliding
    // it far enough right that the angler sits in the left third of frame and
    // the pond fills the rest.
    this.cameraRig = new CameraRig(this.camera, ANGLER_SEAT, ANGLER_WATER_FOCUS, {
      distance: 2.9,
      height: 1.95,
      shoulderOffset: 1.55,
    });
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

    this.diorama = { root: new THREE.Group(), barnabySlot: new THREE.Group(), fishbotSlot: new THREE.Group(), playerSlot: new THREE.Group(), anglerCrate: new THREE.Group(), lilypads: [], clouds: [], diagnostics: { meshCount: 0, propTypeCount: 0 } };
    this.themeManager = new ThemeManager(this.scene, this.water, this.audio, initialTheme, (diorama) => this.onDioramaRebuilt(diorama));

    this.diorama.playerSlot.add(this.playerCharacter.group);
    this.playerCharacter.setSeated(true);
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
      this.playerCharacter.setPose('idle');
      this.cameraRig.focusOn(this.diorama.playerSlot.position);
    });
    this.events.on('closetClosed', () => {
      this.closetOpen = false;
      this.cameraRig.focusOnWater();
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
      getCraftingBenchPosition: () => new THREE.Vector3(-2.9, 0.7, -1.9),
    });

    this.events.on('themeChanged', ({ theme }) => void this.themeManager.setTheme(theme));
    this.events.on('catchResolved', ({ result }) => {
      if (!result.isTrash) this.spawnFishLeap(result.rarity === 'legendary');
    });

    if (import.meta.env.DEV) {
      const devWindow = window as unknown as { __game_scene?: THREE.Scene; __game_camera?: THREE.PerspectiveCamera };
      devWindow.__game_scene = this.scene;
      devWindow.__game_camera = this.camera;
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
    diorama.playerSlot.add(this.playerCharacter.group);
    // A theme swap rebuilds every prop including the crate, so re-seat rather
    // than assume the character kept its posture across the rebuild.
    this.playerCharacter.setSeated(true);
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
        this.playerCharacter.setPose('fishing');
        this.playerCharacter.setFishingSubPose(phase);
        if (phase === 'casting') this.throwBobber();
        break;
      case 'celebrating':
        this.playerCharacter.setPose('wave');
        break;
      default:
        // idle / resolving / missed: back to the seated resting pose. Setting
        // it here rather than every frame in updatePlayerCharacter is what
        // lets the one-shot catch wave above actually play out its 1.5s before
        // PlayerCharacter drops itself back to idle.
        this.playerCharacter.setPose('idle');
        break;
    }
  }

  /**
   * Throws the bobber at whatever point on the pond the player clicked.
   *
   * The click is resolved against the water *plane* rather than the water mesh, then clamped
   * into the pond disc — casting where you aimed is the whole point of the shot, so a click
   * that lands slightly past the rim (or on a lilypad, or on the far bank behind the water)
   * should still throw toward it instead of silently falling back to a random cast. Only a
   * click with no forward ground intersection at all — the sky — takes the cone fallback,
   * which is also the path keyboard casts and the fishbot use.
   */
  private throwBobber(): void {
    const playerWorldPos = new THREE.Vector3();
    this.playerCharacter.group.getWorldPosition(playerWorldPos);
    const startPos = this.playerCharacter.getRodTipWorldPosition(new THREE.Vector3());

    let landingPos = this.clickedWaterPoint();

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

    // Clamp into castable water regardless of which branch produced the point: the cone
    // fallback is anchored on the angler, who sits just outside the pond rim.
    landingPos.y = WATER_Y;
    this.clampToCastableWater(landingPos, playerWorldPos);

    this.bobber.throwTo(startPos, landingPos, CASTING_ANIM_SECONDS);
  }

  /** Where the most recent click ray meets the water plane, or null if it never does. */
  private clickedWaterPoint(): THREE.Vector3 | null {
    const event = this.input.lastClickEvent;
    if (!event) return null;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);

    const hit = raycaster.ray.intersectPlane(WATER_PLANE, new THREE.Vector3());
    return hit;
  }

  /**
   * Pulls a landing point onto water the player can actually see and reach: inside the
   * drawn pond disc, and not right on top of the angler.
   */
  private clampToCastableWater(landing: THREE.Vector3, anglerPos: THREE.Vector3): void {
    const fromCentre = Math.hypot(landing.x, landing.z);
    if (fromCentre > CAST_MAX_RADIUS) {
      const scale = CAST_MAX_RADIUS / fromCentre;
      landing.x *= scale;
      landing.z *= scale;
    }

    const dx = landing.x - anglerPos.x;
    const dz = landing.z - anglerPos.z;
    const fromAngler = Math.hypot(dx, dz);
    if (fromAngler > 0 && fromAngler < CAST_MIN_DISTANCE) {
      const push = CAST_MIN_DISTANCE / fromAngler;
      landing.x = anglerPos.x + dx * push;
      landing.z = anglerPos.z + dz * push;
    }
  }

  private async loadHeroAssets(): Promise<void> {
    const [barnaby, fishbot, genericFish, prismKoi, oldBoot, bobberAsset] = await Promise.allSettled([
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.barnaby),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.fishbot),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.genericFish),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.prismKoi),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.oldBoot),
      loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.bobber),
    ]);

    if (barnaby.status === 'fulfilled') {
      const fbxLoader = new FBXLoader();
      try {
        const [idleFbx, walkFbx] = await Promise.all([
          fbxLoader.loadAsync('./models/barnaby-anim/idle.fbx'),
          fbxLoader.loadAsync('./models/barnaby-anim/walk.fbx')
        ]);

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
        const walkClip = stripHorizontalMovement(walkFbx.animations[0]);

        this.barnabyIdleAction = this.barnabyMixer.clipAction(idleClip);
        this.barnabyWalkAction = this.barnabyMixer.clipAction(walkClip);
        this.barnabyIdleAction.play();
        this.barnabyIsWalking = false;
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
    if (!this.fishbotGroup) return;
    const isAuto = this.fishingState.autoFishingEnabled;
    const targetEmissive = isAuto ? 0x66ff66 : 0x000000;
    this.fishbotGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.userData.originalMaterial) child.userData.originalMaterial = child.material;
        child.material = child.userData.originalMaterial.clone();
        child.material.emissive.setHex(targetEmissive);
        child.material.emissiveIntensity = isAuto ? 0.8 : 0;
      }
    });
  }

  private updateFishbotVisibility(): void {
    if (!this.fishbotGroup) return;
    this.fishbotGroup.visible = this.economy.ownedFishbots().length > 0;
  }

  /**
   * Keeps the seated angler's animation ticking. There is no wander loop any
   * more: the character is sat on the crate at the water's edge, which is what
   * the fixed over-the-shoulder camera is framed around, so moving them would
   * only slide them out of their own shot. Pose control lives entirely in
   * onFishingPhaseChanged (fishing/wave), with idle as the resting state.
   */
  private updatePlayerCharacter(delta: number): void {
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

    if (this.input.justPressed() && this.input.lastClickEvent && this.fishbotGroup && this.fishbotGroup.visible) {
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
        const intersects = raycaster.intersectObject(this.fishbotGroup, true);
        if (intersects.length > 0) {
          this.fishingState.autoFishingEnabled = true;
          this.input.consumePress();
          this.updateFishbotGlow();
          
          const activeBots = this.economy.ownedFishbots();
          const botName = activeBots.length > 0 ? activeBots[0].name : 'Fishbot';
          this.events.emit('fishbotToggled', { enabled: true, name: botName });
        }
      }
    }

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
    const nibble = this.fishingState.snapshot().nibbleProgress;
    this.bobber.setVisible(phase === 'casting' || phase === 'waiting' || phase === 'bite' || phase === 'celebrating');
    this.bobber.update(delta, phase, nibble);

    const lineTaut = phase === 'casting' || phase === 'waiting' || phase === 'bite';
    this.fishingLine.setVisible(lineTaut);
    if (lineTaut) {
      const rodTip = this.playerCharacter.getRodTipWorldPosition(new THREE.Vector3());
      this.fishingLine.update(rodTip, this.bobber.group.position);
    }
    if (phase === 'waiting') {
      // Timer-based cadence: one ripple every 2s. (A floor(elapsed)%N check
      // is true for a whole 0.5s window each cycle — ~30 emits per window.)
      // The pre-bite tell tightens that to ~0.35s, so the water starts
      // churning around the float in step with its bobbing.
      this.rippleTimer -= delta;
      if (this.rippleTimer <= 0) {
        this.rippleTimer = THREE.MathUtils.lerp(2, 0.35, nibble);
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

    if (this.barnabyMixer && this.barnabyGroup) {
      this.barnabyMixer.update(delta);
      this.barnabyWalkTimer -= delta;

      if (this.barnabyWalkTimer <= 0) {
        this.barnabyIsWalking = !this.barnabyIsWalking;
        this.barnabyWalkTimer = this.barnabyIsWalking ? 3 + Math.random() * 2 : 2 + Math.random() * 3;
        
        if (this.barnabyIsWalking) {
          this.barnabyIdleAction?.crossFadeTo(this.barnabyWalkAction!, 0.3, false);
          this.barnabyWalkAction?.reset().play();
          
          let valid = false;
          let targetLocal = new THREE.Vector3();
          for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const rad = Math.random() * 4.5;
            targetLocal.set(Math.cos(angle) * rad, 0, Math.sin(angle) * rad);
            
            // Read his real slot rather than a copy of its coordinates — he
            // moved to the far-right bank when the camera did, and a stale
            // literal here would have him wander the wrong shore.
            const slot = this.diorama.barnabySlot.position;
            const worldX = slot.x + targetLocal.x;
            const worldZ = slot.z + targetLocal.z;
            const distToCenter = Math.hypot(worldX, worldZ);
            
            // Grassy bank is approx between radius 3.2 and 4.8
            if (distToCenter > 3.2 && distToCenter < 4.8) {
              // Stay out of the market stall's footprint, and off the angler's
              // side of the pond so he never wanders into the foreground.
              const clearOfStall = Math.hypot(worldX - 2.9, worldZ - -1.5) > 1.5;
              const clearOfAngler = Math.hypot(worldX - ANGLER_SEAT.x, worldZ - ANGLER_SEAT.z) > 2.0;
              if (clearOfStall && clearOfAngler) {
                valid = true;
                break;
              }
            }
          }
          if (valid) {
            this.barnabyTargetPos = targetLocal;
          } else {
            // No valid bank point found in 10 tries — stay put rather than fall
            // back to an unchecked small offset, which could still land inside
            // the pond (his slot is only ~3.26 from center, barely past the
            // 3.0 pond radius).
            this.barnabyTargetPos = this.barnabyGroup?.position.clone() ?? new THREE.Vector3();
          }
        } else {
          this.barnabyWalkAction?.crossFadeTo(this.barnabyIdleAction!, 0.3, false);
          this.barnabyIdleAction?.reset().play();
        }
      }

      if (this.barnabyIsWalking && this.barnabyTargetPos) {
        const speed = 0.3;
        const currentPos = this.barnabyGroup.position;
        const dist = currentPos.distanceTo(this.barnabyTargetPos);
        if (dist > 0.05) {
          const dir = new THREE.Vector3().subVectors(this.barnabyTargetPos, this.barnabyGroup.position).normalize();
          this.barnabyGroup.position.addScaledVector(dir, speed * delta);
          
          // Model faces -X natively, so we offset the atan2 by -PI/2 to face forward
          const targetAngle = Math.atan2(dir.x, dir.z) - Math.PI / 2;
          let currentAngle = this.barnabyGroup.rotation.y;
          const diff = ((targetAngle - currentAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          this.barnabyGroup.rotation.y += diff * 5 * delta;
        } else {
          this.barnabyWalkTimer = 0; // stop walking
        }
      }
    }

    this.updatePlayerCharacter(delta);

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
    // Stand the preview camera in front of the character along whatever
    // direction the slot actually faces — the seat is angled across the pond
    // now, so assuming -Z would frame the back of their head.
    const facing = this.diorama.playerSlot.getWorldDirection(new THREE.Vector3());
    // Seated: the head sits about a hip-height lower than it would standing,
    // so the preview looks at the torso rather than over the character.
    const eyeY = slotPos.y + 0.75;
    this.closetCamera.position.set(
      slotPos.x + facing.x * 1.9,
      slotPos.y + 0.65,
      slotPos.z + facing.z * 1.9,
    );
    this.closetCamera.lookAt(slotPos.x, eyeY, slotPos.z);

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
