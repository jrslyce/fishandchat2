import * as THREE from 'three';
import type { AudioEngine } from '../core/AudioEngine';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';
import type { Economy } from '../game/Economy';
import type { WaterSystem } from './WaterSystem';
import { checkBottleDiscovery, getLoreBottle } from '../game/LoreBottles';
import { loadImportedAsset, normalizedClone } from '../assets/ImportedAssetRegistry';
import { MODEL_SOURCE_MANIFEST_PUBLIC } from '../assets/manifest';
import { BARNABY_DOCK_POSITION } from '../world/DioramaBuilder';

export type DialogueMood = 'normal' | 'excited' | 'mysterious' | 'weather';

interface SpeechState {
  fullText: string;
  displayedLength: number;
  typewriterTimer: number;
  charsPerSecond: number;
  isComplete: boolean;
  dismissTimer: number;
  durationSeconds: number;
  mood: DialogueMood;
}

const BARNABY_SMALL_TALK = [
  'Keep your rod tip high and your heart steady, friend.',
  'The water tells stories if you take the time to listen.',
  'Back in my sailing days, we used to chart constellations by the glimmer of night fish.',
  'Check the market often! You never know when prices might surge.',
  'They say strange bottles wash ashore after heavy tides. Keep an eye out for them!',
  'A sturdy braided line makes all the difference when pulling from the deep.',
  'Glurp... old bones feel the weather shifting before the clouds even gather.',
  "Don't rush the reel. The sweetest catches test your patience.",
  'Have you tried different lures? Each fish has its own appetite, just like people.',
  'Salt spray on your cheeks, a warm coat, and a calm pond. Nothing better.',
];

const BARNABY_LORE_HINTS = [
  'I sealed some old logbooks in brass bottles years ago... wonder where the currents took them.',
  'They say the S.S. Marigold sailed into a lilac mist and never struck a reef. Strange tales...',
  'If you ever reach the Abyssal Trench, bring a heavy sinker. The darkness down there has eyes.',
  'The Cosmic Lake only reveals its starlit carp to seasoned anglers who have mastered the rod.',
  'Watch the shallows near the shore. Sometimes lost bottles drift in with the waves.',
  'The ancient leviathan shed a fang centuries ago. The tribes carved protection runes into it.',
  'When rain dimples the water, the shyest giants stir from the muddy bed.',
];

/**
 * NarrativeSystem brings the diorama world to life with:
 * - Compact Barnaby dialogue below the action area.
 * - Reactive environmental dialogues (weather shifts, whale & kraken breaches,
 *   community boss raids, legendary catches, and catch streaks).
 * - Interactive Barnaby NPC on the dock with cycling dialogue and hints.
 * - 3D floating "Message in a Bottle" prop with sinusoidal wave bobbing and click collection.
 */
export class NarrativeSystem {
  private readonly barnabyRoot = new THREE.Group();
  private readonly bottleRoot = new THREE.Group();
  private camera?: THREE.Camera;

  // Speech bubble DOM elements
  private bubbleElement: HTMLElement | null = null;
  private bubbleTextElement: HTMLElement | null = null;
  private bubbleMoodBadgeElement: HTMLElement | null = null;
  private speechState: SpeechState | null = null;
  private queuedDialogue: { text: string; durationSeconds: number; mood: DialogueMood } | null = null;
  private soundBlipCooldown = 0;

  // 3D bottle state
  private activeBottleId: string | null = null;
  private activeBottleMesh: THREE.Group | null = null;
  private disposed = false;
  private bottleTime = 0;
  private bottleRippleTimer = 0;
  private bottleBasePos = new THREE.Vector3(0.85, -0.05, -0.3);

  // Barnaby animation & interaction
  private barnabyBreathingTime = 0;
  private barnabyBounceTime = 0;
  private barnabyClickIndex = 0;
  private barnabyModelLoaded = false;
  private barnabyPlaceholderMesh: THREE.Group | null = null;

  // Community raid tracking to avoid repeat dialogue spam
  private announcedRaidId: string | null = null;
  private announced50PercentRaidId: string | null = null;

  // Bound event listeners for clean disposal
  private readonly boundPointerDown: (e: PointerEvent) => void;
  private readonly eventUnsubscribers: (() => void)[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly water: WaterSystem,
    private readonly audio: AudioEngine,
    private readonly events: EventBus<GameEventMap>,
    private readonly economy: Economy,
    camera?: THREE.Camera,
  ) {
    this.camera = camera;

    // 1. Build Barnaby dock NPC anchor
    this.barnabyRoot.name = 'DockBarnabyNPC';
    this.barnabyRoot.position.set(BARNABY_DOCK_POSITION.x, BARNABY_DOCK_POSITION.y, BARNABY_DOCK_POSITION.z);
    // Alt-A Meshy Barnaby faces +Z locally; angle slightly toward camera and angler.
    this.barnabyRoot.rotation.y = 0.28;
    this.scene.add(this.barnabyRoot);

    this.buildBarnabyPlaceholder();
    void this.loadBarnabyModel();

    // 2. Setup Message in a Bottle root
    this.bottleRoot.name = 'LoreBottlePropRoot';
    this.scene.add(this.bottleRoot);

    // 3. Mount UI Bubble & Styles
    this.mountSpeechBubble();

    // 4. Wire Gameplay & Living World Events
    this.bindLivingWorldEvents();

    // 5. Input Interaction (Canvas clicks on Barnaby / Bottle)
    this.boundPointerDown = (e: PointerEvent) => this.onPointerDown(e);
    window.addEventListener('pointerdown', this.boundPointerDown, { passive: true });
  }

  public setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  public getBarnabyPosition(): THREE.Vector3 {
    return this.barnabyRoot.position.clone();
  }

  public hasWaterBottle(): boolean {
    return this.activeBottleId !== null;
  }

  public getActiveBottleId(): string | null {
    return this.activeBottleId;
  }

  public getCurrentDialogue(): string | null {
    return this.speechState ? this.speechState.fullText : null;
  }

  public isBarnabyModelLoaded(): boolean {
    return this.barnabyModelLoaded;
  }

  // =========================================================================
  // DIALOGUE PRESENTATION & BUBBLE UI
  // =========================================================================

  /**
   * Shows reactive Barnaby dialogue in a stable panel below the action.
   */
  public showDialogue(
    text: string,
    durationSeconds = 7.0,
    mood: DialogueMood = 'normal',
  ): void {
    if (!this.bubbleElement || !this.bubbleTextElement) return;

    this.speechState = {
      fullText: text,
      displayedLength: 0,
      typewriterTimer: 0,
      charsPerSecond: 42,
      isComplete: false,
      dismissTimer: 0,
      durationSeconds: Math.max(3.0, durationSeconds),
      mood,
    };

    // Update mood styling
    this.bubbleElement.classList.remove('mood-normal', 'mood-excited', 'mood-mysterious', 'mood-weather');
    this.bubbleElement.classList.add(`mood-${mood}`);

    if (this.bubbleMoodBadgeElement) {
      const badgeIcon =
        mood === 'excited' ? '✨' : mood === 'mysterious' ? '📜' : mood === 'weather' ? '🌦️' : '💬';
      this.bubbleMoodBadgeElement.textContent = badgeIcon;
    }

    this.bubbleTextElement.textContent = '';
    this.bubbleElement.classList.remove('hidden');

    // Initial audio blip
    this.playSpeechBlip(mood);
  }

  public dismissDialogue(): void {
    if (this.bubbleElement) {
      this.bubbleElement.classList.add('hidden');
    }
    this.speechState = null;
  }

  private playSpeechBlip(mood: DialogueMood): void {
    const synth = this.audio.getSynthesizer();
    if (!synth) return;

    if (mood === 'excited') {
      try {
        synth.playSeagullChirp();
        return;
      } catch {
        // Fallback to pitch blip if chirp not available
      }
    }

    // Gentle speech blip
    const pitch = mood === 'mysterious' ? 220 : mood === 'weather' ? 260 : 310;
    synth.playDialogueBlip(pitch, 0.1);
  }

  private mountSpeechBubble(): void {
    let existing = document.getElementById('barnaby-speech-bubble');
    if (!existing) {
      const container = document.getElementById('app') || document.body;
      existing = document.createElement('div');
      existing.id = 'barnaby-speech-bubble';
      existing.className = 'narrative-speech-bubble hidden mood-normal';
      existing.setAttribute('role', 'status');
      existing.setAttribute('aria-live', 'polite');
      existing.innerHTML = `
        <div class="bubble-header">
          <span class="bubble-speaker">Old Barnaby</span>
          <span class="bubble-mood-badge">💬</span>
        </div>
        <div class="bubble-body">
          <p class="bubble-text"></p>
        </div>
        <button type="button" class="bubble-dismiss-btn" aria-label="Dismiss message">✕</button>
      `;
      container.appendChild(existing);
    }

    this.bubbleElement = existing;
    this.bubbleTextElement = existing.querySelector('.bubble-text');
    this.bubbleMoodBadgeElement = existing.querySelector('.bubble-mood-badge');

    // A pointer on the card should not also cast or reel through #app.
    this.bubbleElement.addEventListener('pointerdown', (e) => e.stopPropagation());

    // Tap/click bubble to accelerate typewriter or dismiss
    this.bubbleElement.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.speechState) {
        this.dismissDialogue();
        return;
      }
      if (!this.speechState.isComplete) {
        // Fast-forward typewriter to end
        this.speechState.displayedLength = this.speechState.fullText.length;
        this.speechState.isComplete = true;
        if (this.bubbleTextElement) {
          this.bubbleTextElement.textContent = this.speechState.fullText;
        }
      } else {
        // Dismiss
        this.dismissDialogue();
      }
    });

    const dismissBtn = existing.querySelector('.bubble-dismiss-btn');
    dismissBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismissDialogue();
    });
  }

  // =========================================================================
  // 3D FLOATING MESSAGE IN A BOTTLE PROP
  // =========================================================================

  /**
   * Spawns a small 3D bottle mesh in the water near the shoreline.
   */
  public spawnWaterBottle(bottleId: string): void {
    if (this.activeBottleId === bottleId && this.activeBottleMesh) return;

    this.removeWaterBottle();

    this.activeBottleId = bottleId;
    this.bottleTime = 0;
    this.bottleRippleTimer = 0.5;

    const group = new THREE.Group();
    group.name = `WaterBottle_${bottleId}`;

    // Glass bottle cylinder body
    const bodyGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.22, 12);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x86c5da,
      transparent: true,
      opacity: 0.72,
      roughness: 0.15,
      metalness: 0.08,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, glassMat);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Glass neck
    const neckGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.07, 10);
    const neckMesh = new THREE.Mesh(neckGeo, glassMat);
    neckMesh.position.y = 0.145;
    group.add(neckMesh);

    // Cork stopper
    const corkGeo = new THREE.CylinderGeometry(0.032, 0.026, 0.045, 10);
    const corkMat = new THREE.MeshStandardMaterial({
      color: 0x9e6938,
      roughness: 0.85,
      metalness: 0.0,
    });
    const corkMesh = new THREE.Mesh(corkGeo, corkMat);
    corkMesh.position.y = 0.19;
    group.add(corkMesh);

    // Rolled parchment scroll inside
    const scrollGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8);
    const scrollMat = new THREE.MeshStandardMaterial({
      color: 0xf5eccb,
      roughness: 0.7,
      metalness: 0.0,
    });
    const scrollMesh = new THREE.Mesh(scrollGeo, scrollMat);
    scrollMesh.position.set(0.005, -0.01, 0.005);
    scrollMesh.rotation.z = 0.1;
    group.add(scrollMesh);

    // Red wax seal ribbon on scroll
    const ribbonGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.02, 8);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xcc3333,
      roughness: 0.3,
    });
    const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbonMesh.position.copy(scrollMesh.position);
    ribbonMesh.rotation.copy(scrollMesh.rotation);
    group.add(ribbonMesh);

    // Initial placement near shoreline
    group.position.copy(this.bottleBasePos);
    this.bottleRoot.add(group);
    this.activeBottleMesh = group;

    // Splash ripple in water
    this.water.emitRipple(this.bottleBasePos.x, this.bottleBasePos.z);
  }

  /**
   * Removes the active 3D floating bottle prop from the water.
   */
  public removeWaterBottle(): void {
    if (!this.activeBottleMesh) return;

    this.water.emitRipple(this.activeBottleMesh.position.x, this.activeBottleMesh.position.z);
    this.bottleRoot.remove(this.activeBottleMesh);

    this.activeBottleMesh.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) m?.dispose();
      }
    });

    this.activeBottleMesh = null;
    this.activeBottleId = null;
  }

  private collectActiveBottle(): void {
    if (!this.activeBottleId) return;

    const bottleId = this.activeBottleId;
    const bottlePos = this.activeBottleMesh
      ? this.activeBottleMesh.position.clone()
      : this.bottleBasePos.clone();

    // 1. Emit bottleTapped
    this.events.emit('bottleTapped', {
      bottleId,
      position: { x: bottlePos.x, y: bottlePos.y, z: bottlePos.z },
    });

    // 2. Discover in economy & look up lore definition
    this.economy.discoverBottle(bottleId);
    const bottleDef = getLoreBottle(bottleId) || {
      id: bottleId,
      title: 'Waterlogged Message',
      sender: 'Unknown Sailor',
      date: 'Years Ago',
      preview: 'A weathered note pulled from the pond.',
      content: 'The ink has faded, but the spirit of the sea remains strong.',
      discoveryClue: 'Found bobbing near the shoreline.',
      reward: { coins: 150, xp: 50 },
    };

    // 3. Emit loreBottleDiscovered
    this.events.emit('loreBottleDiscovered', {
      bottle: bottleDef,
      bottleId,
    });

    // 4. Audio feedback & Dialogue
    this.audio.getSynthesizer().playWaterSplash(0.85);
    this.showDialogue(
      `You fished out "${bottleDef.title}"! Let's see what secrets it holds...`,
      8.0,
      'mysterious',
    );

    // 5. Remove prop from water
    this.removeWaterBottle();
  }

  // =========================================================================
  // LIVING WORLD & GAMEPLAY EVENT LISTENERS
  // =========================================================================

  private bindLivingWorldEvents(): void {
    // Weather shifts
    this.eventUnsubscribers.push(
      this.events.on('weatherChanged', ({ weather }) => {
        this.onWeatherChanged(weather);
        this.checkTriggerBottleDiscovery({ type: 'weather', weather });
      }),
    );

    // Whale breach
    this.eventUnsubscribers.push(
      this.events.on('whaleJump', () => {
        this.showDialogue(
          'Thar she blows! A humpback breaches on the horizon!',
          4.5,
          'excited',
        );
        this.checkTriggerBottleDiscovery({ type: 'whale' });
      }),
    );

    // Kraken breach
    this.eventUnsubscribers.push(
      this.events.on('krakenBreach', () => {
        this.showDialogue(
          'The Old One stirs! Tentacles rise from the deep!',
          4.5,
          'mysterious',
        );
        this.checkTriggerBottleDiscovery({ type: 'kraken' });
      }),
    );

    // Community boss raid progress & milestones
    this.eventUnsubscribers.push(
      this.events.on('communityProgressUpdated', ({ goalId, current, target }) => {
        if (target <= 0) return;
        const ratio = current / target;

        // 1. Raid Starting
        if (current === 0 && this.announcedRaidId !== goalId) {
          this.announcedRaidId = goalId;
          this.announced50PercentRaidId = null;
          this.showDialogue(
            'Anglers of the channel, rally! A new community raid has begun in the waters!',
            7.5,
            'excited',
          );
        }
        // 2. 50% Milestone
        else if (ratio >= 0.5 && this.announced50PercentRaidId !== goalId) {
          this.announced50PercentRaidId = goalId;
          this.showDialogue(
            'Halfway there, everyone! The channel is pulling together—keep the pressure on!',
            7.0,
            'excited',
          );
        }
      }),
    );

    // Community boss raid completion
    this.eventUnsubscribers.push(
      this.events.on('communityGoalCompleted', ({ name }) => {
        this.showDialogue(
          `Incredible haul! The community defeated ${name}! Three cheers for the finest crew on the pond!`,
          8.5,
          'excited',
        );
      }),
    );

    // Catch milestones (Legendary catches, high catch streaks)
    this.eventUnsubscribers.push(
      this.events.on('catchResolved', ({ result }) => {
        if (result.rarity === 'legendary') {
          this.showDialogue(
            `GREAT GUPPIES! A LEGENDARY ${result.name.toUpperCase()}! In all my years, I've rarely seen such a beauty, captain!`,
            8.0,
            'excited',
          );
        } else if (result.rarity === 'epic') {
          this.showDialogue(
            `Look at that whopper! A rare ${result.name}! You're making quite a splash on this dock!`,
            6.5,
            'excited',
          );
        }
        this.checkTriggerBottleDiscovery({ type: 'catch', rarity: result.rarity });
      }),
    );

    // Catch streaks
    this.eventUnsubscribers.push(
      this.events.on('streakChanged', ({ streak }) => {
        if (streak >= 5 && streak % 5 === 0) {
          this.showDialogue(
            `A streak of ${streak} in a row! You've got ice in your veins, friend!`,
            6.5,
            'excited',
          );
        }
      }),
    );

    // Level up check for lore bottles
    this.eventUnsubscribers.push(
      this.events.on('xpGained', ({ leveledUp, newLevel }) => {
        if (leveledUp) {
          this.checkTriggerBottleDiscovery({ type: 'level', level: newLevel });
        }
      }),
    );
  }

  private onWeatherChanged(weather: string): void {
    const w = weather.toLowerCase();
    switch (w) {
      case 'rain':
        this.showDialogue(
          'Ah, a proper drizzle! The fish get bolder when raindrops dimple the water, lad.',
          7.0,
          'weather',
        );
        break;
      case 'fog':
        this.showDialogue(
          'Fog rolls in thick as clam chowder... keep your lantern high, who knows what drifts in the mist.',
          7.5,
          'weather',
        );
        break;
      case 'golden-hour':
        this.showDialogue(
          'Look at that horizon glow! Golden hour is pure magic for casting a line.',
          7.0,
          'weather',
        );
        break;
      case 'rainbow':
        this.showDialogue(
          'By the Great Marlin! A vibrant rainbow over the bay! Luck is truly smiling on us today!',
          8.0,
          'excited',
        );
        break;
      default:
        break;
    }
  }

  private checkTriggerBottleDiscovery(trigger: {
    type: 'catch' | 'weather' | 'whale' | 'kraken' | 'level';
    rarity?: string;
    weather?: string;
    level?: number;
  }): void {
    if (this.hasWaterBottle()) return;

    const owned = this.economy.discoveredBottleIds();
    const candidate = checkBottleDiscovery(trigger, owned);
    if (candidate) {
      this.spawnWaterBottle(candidate.id);
      const hintText = 'Look there! Something bobbing in the shallows near the shore... looks like an old bottle!';
      if (this.speechState) {
        this.queuedDialogue = {
          text: hintText,
          durationSeconds: 7.5,
          mood: 'mysterious',
        };
      } else {
        this.showDialogue(hintText, 7.5, 'mysterious');
      }
    }
  }

  // =========================================================================
  // INTERACTIVE BARNABY DOCK NPC
  // =========================================================================

  /**
   * Called when player clicks on Barnaby on the dock (cycling small talk + story hints).
   */
  public triggerBarnabyInteraction(): void {
    this.barnabyBounceTime = 0.35;
    this.barnabyClickIndex += 1;

    // Cycle between greetings, story hints, and small talk
    if (this.barnabyClickIndex === 1) {
      const name = this.economy.displayName() || 'rookie';
      this.showDialogue(`Welcome to the dock, ${name}! Grab a pole and take your time.`, 6.5, 'normal');
      return;
    }

    if (this.barnabyClickIndex % 3 === 0) {
      // Story & lore hint
      const hint = BARNABY_LORE_HINTS[Math.floor(Math.random() * BARNABY_LORE_HINTS.length)];
      this.showDialogue(hint, 7.5, 'mysterious');
    } else {
      // Cozy small talk
      const talk = BARNABY_SMALL_TALK[Math.floor(Math.random() * BARNABY_SMALL_TALK.length)];
      this.showDialogue(talk, 6.5, 'normal');
    }
  }

  private buildBarnabyPlaceholder(): void {
    const group = new THREE.Group();
    group.name = 'BarnabyStylizedMesh';

    // Plump sitting golden clay catfish torso
    const goldMat = new THREE.MeshStandardMaterial({ color: '#e8b647', roughness: 0.78 });
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), goldMat);
    torso.scale.set(1.05, 1.0, 0.95);
    torso.position.y = 0.22;
    torso.castShadow = true;
    group.add(torso);

    // Knitted indigo denim apron bib over chest
    const apronMat = new THREE.MeshStandardMaterial({ color: '#456896', roughness: 0.9 });
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.26, 12), apronMat);
    apron.position.set(0, 0.20, 0.03);
    apron.castShadow = true;
    group.add(apron);

    // Broad catfish head + rosy smiling lips
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), goldMat);
    head.scale.set(1.18, 0.9, 1.05);
    head.position.set(0, 0.48, 0.02);
    head.castShadow = true;
    group.add(head);

    const lipMat = new THREE.MeshStandardMaterial({ color: '#f0949a', roughness: 0.65 });
    const lips = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 14), lipMat);
    lips.position.set(0, 0.45, 0.18);
    lips.scale.set(1.3, 0.65, 0.8);
    group.add(lips);

    const eyeMat = new THREE.MeshStandardMaterial({ color: '#1b1815', roughness: 0.25 });
    for (const x of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), eyeMat);
      eye.position.set(x, 0.54, 0.16);
      group.add(eye);
    }

    // Stubby webbed feet pointing forward (+Z)
    for (const x of [-0.11, 0.11]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.05, 0.15), goldMat);
      foot.position.set(x, 0.03, 0.18);
      foot.castShadow = true;
      group.add(foot);
    }

    this.barnabyPlaceholderMesh = group;
    this.barnabyRoot.add(group);
  }

  private async loadBarnabyModel(): Promise<void> {
    try {
      const asset = await loadImportedAsset(MODEL_SOURCE_MANIFEST_PUBLIC.barnaby);
      if (!asset || !asset.root || this.disposed) return;

      const model = normalizedClone(asset, 0.68);
      model.name = 'BarnabyImportedGLB';
      model.position.set(0, 0, 0);
      model.traverse((child) => {
        child.userData.sharedAsset = true;
      });

      // Remove placeholder mesh and attach imported GLB
      if (this.barnabyPlaceholderMesh) {
        this.barnabyRoot.remove(this.barnabyPlaceholderMesh);
        this.disposeObject(this.barnabyPlaceholderMesh);
        this.barnabyPlaceholderMesh = null;
      }

      this.barnabyRoot.add(model);
      this.barnabyModelLoaded = true;
    } catch {
      // Keep placeholder mesh if GLB fails or in lightweight mode
    }
  }

  // =========================================================================
  // INPUT POINTER INTERACTION
  // =========================================================================

  private onPointerDown(event: PointerEvent): void {
    if (!this.camera) return;

    // Ensure click is on game canvas or container
    const target = event.target as HTMLElement | null;
    if (target && target.closest('button, input, select, textarea, .modal, #barnaby-speech-bubble, #hud-coins, #action-btn')) {
      return;
    }

    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas') || document.querySelector('canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), this.camera);

    // 1. Check intersection with Water Bottle
    if (this.activeBottleMesh) {
      const bottleHits = raycaster.intersectObjects(this.activeBottleMesh.children, true);
      // Also check 3D proximity distance for forgiving touch control
      const distToBottle = raycaster.ray.distanceToPoint(this.activeBottleMesh.position);

      if (bottleHits.length > 0 || distToBottle < 0.45) {
        this.collectActiveBottle();
        return;
      }
    }

    // 2. Check intersection with Barnaby NPC
    const barnabyHits = raycaster.intersectObjects(this.barnabyRoot.children, true);
    const distToBarnaby = raycaster.ray.distanceToPoint(this.barnabyRoot.position);

    if (barnabyHits.length > 0 || distToBarnaby < 0.6) {
      this.triggerBarnabyInteraction();
    }
  }

  // =========================================================================
  // FRAME UPDATE LOOP
  // =========================================================================

  public update(delta: number): void {
    // 1. Update 3D Floating Bottle wave bobbing
    if (this.activeBottleMesh) {
      this.bottleTime += delta;

      // Sinusoidal wave bobbing
      const bobY = this.bottleBasePos.y + Math.sin(this.bottleTime * 2.4) * 0.024;
      this.activeBottleMesh.position.y = bobY;

      // Sinusoidal wave roll & pitch rocking
      this.activeBottleMesh.rotation.z = Math.sin(this.bottleTime * 1.8) * 0.16;
      this.activeBottleMesh.rotation.x = Math.cos(this.bottleTime * 1.4) * 0.11;
      this.activeBottleMesh.rotation.y += delta * 0.18;

      // Periodic water ripple
      this.bottleRippleTimer -= delta;
      if (this.bottleRippleTimer <= 0) {
        this.bottleRippleTimer = 2.4;
        this.water.emitRipple(this.activeBottleMesh.position.x, this.activeBottleMesh.position.z);
      }
    }

    // 2. Update Barnaby breathing & bounce animation
    this.barnabyBreathingTime += delta;
    const breath = 1.0 + Math.sin(this.barnabyBreathingTime * 1.8) * 0.015;

    if (this.barnabyBounceTime > 0) {
      this.barnabyBounceTime = Math.max(0, this.barnabyBounceTime - delta);
      const bounce = 1.0 + Math.sin((this.barnabyBounceTime / 0.35) * Math.PI) * 0.08;
      this.barnabyRoot.scale.set(bounce, bounce * breath, bounce);
    } else {
      this.barnabyRoot.scale.set(1.0, breath, 1.0);
    }

    // 3. Update typewriter & auto-dismiss for dialogue bubble
    if (this.speechState && this.bubbleTextElement) {
      this.soundBlipCooldown = Math.max(0, this.soundBlipCooldown - delta);

      if (!this.speechState.isComplete) {
        this.speechState.typewriterTimer += delta;
        const targetLength = Math.min(
          this.speechState.fullText.length,
          Math.floor(this.speechState.typewriterTimer * this.speechState.charsPerSecond),
        );

        if (targetLength > this.speechState.displayedLength) {
          const char = this.speechState.fullText[targetLength - 1];
          this.speechState.displayedLength = targetLength;
          this.bubbleTextElement.textContent = this.speechState.fullText.slice(0, targetLength);

          // Subtle pitch blip on word breaks / characters
          if (this.soundBlipCooldown <= 0 && char !== ' ') {
            this.soundBlipCooldown = 0.09;
            this.audio.getSynthesizer().playDialogueBlip(270 + (targetLength % 5) * 12, 0.06);
          }
        }

        if (this.speechState.displayedLength >= this.speechState.fullText.length) {
          this.speechState.isComplete = true;
        }
      } else {
        // Auto-dismiss countdown after text is fully shown
        this.speechState.dismissTimer += delta;
        if (this.speechState.dismissTimer >= this.speechState.durationSeconds) {
          this.dismissDialogue();
        }
      }
    }

    if (!this.speechState && this.queuedDialogue) {
      const next = this.queuedDialogue;
      this.queuedDialogue = null;
      this.showDialogue(next.text, next.durationSeconds, next.mood);
    }
  }

  // =========================================================================
  // DISPOSAL & CLEANUP
  // =========================================================================

  public dispose(): void {
    this.disposed = true;
    window.removeEventListener('pointerdown', this.boundPointerDown);

    for (const unsubscribe of this.eventUnsubscribers) {
      unsubscribe();
    }
    this.eventUnsubscribers.length = 0;

    this.removeWaterBottle();
    this.queuedDialogue = null;
    this.dismissDialogue();

    if (this.bubbleElement && this.bubbleElement.parentElement) {
      this.bubbleElement.parentElement.removeChild(this.bubbleElement);
      this.bubbleElement = null;
    }

    this.scene.remove(this.barnabyRoot);
    this.disposeObject(this.barnabyRoot);

    this.scene.remove(this.bottleRoot);
    this.disposeObject(this.bottleRoot);
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child.userData.sharedAsset) return;
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) m?.dispose();
      }
    });
  }
}
