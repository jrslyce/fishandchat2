import {
  ARCHETYPE_CATALOG,
  BAIT_CATALOG,
  BASE_TONE_CATALOG,
  BOX_OF_NOT_FISH_CONTENTS,
  BOX_OF_NOT_FISH_COST_CANDY_BARS,
  CANDY_BAR_PACKS,
  CLOTHING_CATALOG,
  FISH_CATALOG,
  FISHBOT_CATALOG,
  MATERIAL_BUNDLE_CATALOG,
  PREMIUM_CATALOG,
  RARITY_ORDER,
  TRASH_CATALOG,
  UPGRADE_CATALOG,
  LEVEL_PERKS,
  xpToNextLevel,
  type ArchetypeId,
  type ClothingDefinition,
  type ClothingSlot,
  type UpgradeId,
} from '../game/data';
import type { Economy, RecycleResult } from '../game/Economy';
import { SPRITE_MANIFEST } from '../assets/spriteManifest';
import type { AudioEngine } from '../core/AudioEngine';
import type { CraftingSystem } from '../systems/CraftingSystem';
import type { FishbotSystem } from '../systems/FishbotSystem';
import type { MuxySystem } from '../systems/MuxySystem';
import type { FishingStateMachine, FishingPhase } from '../game/GameState';
import type { MarketSystem } from '../systems/MarketSystem';
import type { EventBus } from '../core/EventBus';
import type { CatchResult, GameEventMap } from '../game/events';
import type { CosmeticSlot } from '../game/SaveState';
import type { LivingWorldSystem, WeatherType } from '../systems/LivingWorldSystem';
import type { QuestSystem } from '../systems/QuestSystem';
import type { CommunitySystem } from '../systems/CommunitySystem';
import { clothingArt } from './clothingArt';
import type { NarrativeSystem } from '../systems/NarrativeSystem';
import { STORY_CHAPTERS } from '../game/StoryGoals';
import { LORE_BOTTLES, getLoreBottle } from '../game/LoreBottles';
import { CURIO_RELICS } from '../game/RelicSystem';

type ModalId = 'shop' | 'market' | 'craft' | 'collection' | 'settings' | 'candy' | 'closet' | 'skills' | 'quests' | 'guide' | 'debug' | null;

const ICON = {
  coin: './images/icons/coin.png',
  bait: './images/icons/bait.png',
  basket: './images/icons/basket.png',
  hammer: './images/icons/hammer.png',
  scale: './images/icons/scale.png',
  bone: './images/icons/bone.png',
  hamburger: './images/icons/hamburger.png',
} as const;

const CANDY_EMOJI = '🍫';

function escapeWalletText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

function walletAvatar(url: string | null): string | null {
  try {
    const parsed = new URL(url ?? '');
    return parsed.protocol === 'https:' ? escapeWalletText(parsed.href) : null;
  } catch {
    return null;
  }
}

function fashionThumbnail(itemId: string, name: string, fallback: string): string {
  const item = CLOTHING_CATALOG.find((entry) => entry.id === itemId);
  return item
    ? `<span class="clothing-art-wrap" role="img" aria-label="${escapeWalletText(name)}">${clothingArt(itemId, item.slot)}</span>`
    : `<span aria-hidden="true">${fallback}</span>`;
}

/** Barnaby's small talk when you click his portrait in the Shop — always followed by "*gulp*". */
const BARNABY_LINES = [
  "Looks like fine fishing weather out there.",
  "Storm's rolling in by evening, mark my words.",
  "Caught a boot bigger than my own head once.",
  "The big ones always bite right before closing time.",
  "Back in my day, the pond went twice as deep.",
  "There's a hum in the water — good sign, that.",
  "Reel in slow, reel in steady, that's how you keep 'em.",
  "♪ Oh the line goes down, the line goes deep, a fisherman's got no time to sleep ♪",
];
const BARNABY_5TH_CLICK_LINE = "Baker's dozen it is";

function catchName(catchId: string): string {
  return (
    FISH_CATALOG.find((f) => f.id === catchId)?.name ??
    TRASH_CATALOG.find((t) => t.id === catchId)?.name ??
    catchId
  );
}

function icon(src: string, alt: string, cls = 'icon-img'): string {
  return `<img class="${cls}" src="${src}" alt="${alt}" />`;
}

function spriteFor(id: string): string | null {
  return SPRITE_MANIFEST[id] ?? null;
}

function rowIcon(spriteId: string, alt: string, fallback = ''): string {
  const sprite = spriteFor(spriteId);
  if (!sprite) return fallback ? `<div class="row-icon">${fallback}</div>` : '';
  return `<div class="row-icon">${icon(sprite, alt)}</div>`;
}

/**
 * Cozy voxel-diorama UI: warm-wood/paper panels, generated icon sprites
 * (Phase 3's icons.png, sliced and background-keyed), a title screen, and
 * Shop/Market/Craft/Collection/Settings states. Replaces Phase 2's
 * unstyled-functional pass; event-subscription wiring is unchanged.
 */
export class UI {
  private readonly root: HTMLElement;
  private readonly hudLevel: HTMLElement;
  private readonly hudXpFill: HTMLElement;
  private readonly hudCoins: HTMLElement;
  private readonly hudCandyBars: HTMLElement;
  private readonly hudBasketCount: HTMLElement;
  private inBasketTutorial = false;
  private baitTutorialStep: 0 | 1 | 2 | 3 | 4 = 0;
  private dismissedFirstEscapeBubble = false;
  private readonly phaseIndicator: HTMLElement;
  private readonly fishbotStatus: HTMLElement;
  private readonly toastLine: HTMLElement;
  private readonly raidTicker: HTMLElement;
  private readonly raidTickerText: HTMLElement;
  private readonly raidTickerQueue: string[] = [];
  private readonly catchCard: HTMLElement;
  private readonly modalHost: HTMLElement;
  private readonly biteFlash: HTMLElement;
  private readonly titleScreen: HTMLElement;
  private readonly titleWelcome: HTMLElement;
  private readonly titleStart: HTMLButtonElement;
  private readonly titleLoading: HTMLElement;
  private readonly titleLoadingFill: HTMLElement;
  private readonly railToggle: HTMLButtonElement;
  private readonly railItems: HTMLElement;
  private readonly tutorialBubble: HTMLElement;
  private readonly tutorialBubbleText: HTMLButtonElement;
  private readonly tutorialBubbleContent: HTMLElement;
  private readonly tutorialDownTriangle: HTMLElement;
  private readonly basketBadge: HTMLButtonElement;
  private readonly hudStreakPill: HTMLElement;
  private readonly hudCommunityPill: HTMLElement;
  private readonly hudCommunityText: HTMLElement;
  private readonly hudCommunityFill: HTMLElement;

  private livingWorld: LivingWorldSystem | null = null;
  private questSystem: QuestSystem | null = null;
  private communitySystem: CommunitySystem | null = null;
  private narrativeSystem: NarrativeSystem | null = null;
  private activeQuestTab: 'story' | 'daily' | 'milestones' | 'perks' | 'community' | 'lore' = 'story';
  private activeReadingBottleId: string | null = null;
  private activeClosetSlotFilter: 'all' | ClothingSlot = 'all';
  private closetBrowseFilter: 'all' | 'new' | 'owned' | 'candy' | 'ready' = 'all';
  private closetSort: 'catalog' | 'name' = 'catalog';
  private closetSearch = '';
  private returnToClosetFromCandy = false;
  private closetReturnPreviewId: string | null = null;
  private previewClothingId: string | null = null;
  private weatherClothingTipId: 'straw-hat' | 'rain-slicker' | null = null;

  private openModal: ModalId = null;
  private railExpanded = false;
  private uiTourStep = -1;
  private uiTourOpenedRail = false;
  private lastUiTourHighlightStep = -2;
  private toastTimeout: number | null = null;
  private catchCardTimeout: number | null = null;
  private resetArmed = false;
  private debugResetArmed = false;
  private scrapbookOpened = false;
  private lastDuckySecond = 0;
  private barnabyMessage: string | null = null;
  private barnabyClickCount = 0;
  private biteLabel = 'BITE! Tap now!';
  private missedLabel = 'It got away&hellip;';
  private requestedBaitFocus: string | null = null;
  private readonly coinTossOverlay: HTMLElement;
  private coinTossTimeout: number | null = null;

  constructor(
    private readonly economy: Economy,
    private readonly gameState: FishingStateMachine,
    private readonly marketSystem: MarketSystem,
    private readonly craftingSystem: CraftingSystem,
    private readonly fishbotSystem: FishbotSystem,
    private readonly muxySystem: MuxySystem,
    private readonly audio: AudioEngine,
    private readonly events: EventBus<GameEventMap>,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'ui-root';
    document.querySelector('#app')?.appendChild(this.root);

    this.root.innerHTML = `
      <button id="btn-debug" type="button" aria-label="Debug">🖥️</button>
      <div id="hud-top">
        <div id="hud-level-block">
          <span id="hud-level">Lv 1</span>
          <div id="hud-xp-bar"><div id="hud-xp-fill"></div></div>
        </div>
        <div id="hud-pills">
          <div class="hud-pill hidden" id="hud-streak-pill" title="Catch Streak">🔥 0</div>
          <button class="hud-pill hud-pill-button" id="hud-community-pill" type="button" title="Channel Boss Raid">⚓ <span id="hud-community-text">Boss Raid</span><div id="hud-community-progress"><div id="hud-community-fill" style="width: 0%"></div></div></button>
          <div class="hud-pill hidden" id="hud-lucky-ducky-pill">🦆 <span id="hud-lucky-ducky-timer">0:00</span></div>
          <div class="hud-pill" id="hud-coins-pill">${icon(ICON.coin, 'Coins')}<span id="hud-coins">0</span></div>
          <button class="hud-pill hud-pill-button" id="hud-candy-pill" type="button">${CANDY_EMOJI}<span id="hud-candy-bars">0</span></button>
        </div>
      </div>

      <div id="hud-rail">
        <div class="rail-toggle-stack">
          <button class="rail-btn" id="rail-toggle" type="button" aria-label="Menu" aria-expanded="false"><span class="gear-glyph">&#9776;</span></button>
          <button class="rail-btn rail-btn-guide" id="btn-quick-guide" type="button" aria-label="Game Guide" title="How to Play & UI Guide">?</button>
        </div>
        <div id="hud-rail-items" class="hidden">
          <button class="rail-btn" id="btn-quests" type="button" aria-label="Story & Quests"><span class="gear-glyph">📜</span></button>
          <button class="rail-btn" id="btn-shop" type="button" aria-label="Shop">${icon(ICON.bait, 'Shop')}</button>
          <button class="rail-btn" id="btn-market" type="button" aria-label="Market">${icon(ICON.coin, 'Market')}</button>
          <button class="rail-btn" id="btn-craft" type="button" aria-label="Crafting Bench">${icon(ICON.hammer, 'Craft')}</button>
          <button class="rail-btn" id="btn-candy" type="button" aria-label="Candy Bar Shop">${CANDY_EMOJI}</button>
          <button class="rail-btn" id="btn-closet" type="button" aria-label="Closet">&#128100;</button>
          <button class="rail-btn" id="btn-collection" type="button" aria-label="Big Fish Tails Scrap Book" title="Big Fish Tails Scrap Book"><span class="gear-glyph">📖</span></button>
          <button class="rail-btn" id="btn-skills" type="button" aria-label="Skills"><span class="gear-glyph">&#11088;</span></button>
          <button class="rail-btn" id="btn-settings" type="button" aria-label="Settings"><span class="gear-glyph">&#9881;</span></button>
          <button class="rail-btn" id="btn-guide" type="button" aria-label="UI Guide & Tour" title="UI Guide & Tour"><span class="gear-glyph">❓</span></button>
        </div>
      </div>

      <div id="hud-bait-bar" aria-label="Bait Selection">
        ${BAIT_CATALOG.map((bait) => `
          <button class="hud-bait-btn unselected" id="hud-bait-btn-${bait.id}" data-bait-id="${bait.id}" type="button" title="${bait.name}" aria-label="${bait.name}">
            <img class="hud-bait-icon" src="${SPRITE_MANIFEST[bait.id] ?? ICON.bait}" alt="${bait.name}" />
            <span class="hud-bait-qty" id="hud-bait-qty-${bait.id}">${bait.free ? '&infin;' : '0'}</span>
          </button>
        `).join('')}
      </div>

      <button id="basket-badge" type="button" aria-label="Basket">
        ${icon(ICON.basket, 'Basket')}
        <span id="hud-basket-count">0/8</span>
      </button>
      <div id="game-ui">
        <div id="phase-indicator"></div>
        <div id="fishbot-status" class="hidden"></div>
      </div>
      <div id="tutorial-bubble" class="hidden">
        <img class="barnaby-portrait-small" src="./images/barnaby-portrait.png" alt="Barnaby" />
        <button type="button" id="tutorial-bubble-text" class="tutorial-bubble-text">
          <span id="tutorial-bubble-content"></span>
          <span id="tutorial-down-triangle" class="tutorial-down-triangle hidden" aria-hidden="true">&#9660;</span>
        </button>
      </div>
      <div id="toast-line" class="hidden"></div>
      <div id="raid-ticker" class="hidden" role="status" aria-live="polite">
        <span id="raid-ticker-text"></span>
      </div>
      <div id="catch-card" class="hidden"></div>
      <div id="coin-toss-overlay" class="coin-toss-overlay hidden"></div>
      <div id="modal-host" class="hidden"></div>
      <div id="bite-flash"></div>
    `;

    this.hudLevel = this.el('#hud-level');
    this.hudXpFill = this.el('#hud-xp-fill');
    this.hudCoins = this.el('#hud-coins');
    this.hudCandyBars = this.el('#hud-candy-bars');
    this.hudBasketCount = this.el('#hud-basket-count');
    this.hudStreakPill = this.el('#hud-streak-pill');
    this.hudCommunityPill = this.el('#hud-community-pill');
    this.hudCommunityText = this.el('#hud-community-text');
    this.hudCommunityFill = this.el('#hud-community-fill');
    this.phaseIndicator = this.el('#phase-indicator');
    this.fishbotStatus = this.el('#fishbot-status');
    this.biteFlash = document.querySelector<HTMLElement>('#bite-flash')!;
    this.toastLine = document.querySelector<HTMLElement>('#toast-line')!;
    this.raidTicker = this.el('#raid-ticker');
    this.raidTickerText = this.el('#raid-ticker-text');
    this.raidTickerText.addEventListener('animationend', () => {
      this.raidTickerText.classList.remove('scrolling');
      this.advanceRaidTicker();
    });
    this.catchCard = document.querySelector<HTMLElement>('#catch-card')!;
    this.coinTossOverlay = document.querySelector<HTMLElement>('#coin-toss-overlay')!;
    this.modalHost = document.querySelector<HTMLElement>('#modal-host')!;
    this.titleScreen = document.querySelector<HTMLElement>('#title-screen')!;
    this.titleWelcome = document.querySelector<HTMLElement>('#title-welcome')!;
    this.titleStart = document.querySelector<HTMLButtonElement>('#title-start')!;
    this.titleLoading = document.querySelector<HTMLElement>('#title-loading')!;
    this.titleLoadingFill = document.querySelector<HTMLElement>('#title-loading-fill')!;
    this.tutorialBubble = this.el('#tutorial-bubble');
    this.tutorialBubbleText = this.el('#tutorial-bubble-text') as HTMLButtonElement;
    this.tutorialBubbleContent = this.el('#tutorial-bubble-content');
    this.tutorialDownTriangle = this.el('#tutorial-down-triangle');

    this.railToggle = this.el('#rail-toggle') as HTMLButtonElement;
    this.railItems = this.el('#hud-rail-items');
    this.railToggle.addEventListener('click', () => this.toggleRail());

    const railSelect = (id: ModalId) => {
      this.toggleModal(id);
      this.collapseRail();
    };
    this.el('#btn-quests').addEventListener('click', () => railSelect('quests'));
    this.el('#btn-shop').addEventListener('click', () => railSelect('shop'));
    this.el('#btn-market').addEventListener('click', () => railSelect('market'));
    this.el('#btn-craft').addEventListener('click', () => railSelect('craft'));
    this.el('#btn-candy').addEventListener('click', () => railSelect('candy'));
    this.el('#btn-closet').addEventListener('click', () => railSelect('closet'));
    this.el('#btn-collection').addEventListener('click', () => railSelect('collection'));
    this.el('#btn-skills').addEventListener('click', () => railSelect('skills'));
    this.el('#btn-settings').addEventListener('click', () => railSelect('settings'));
    this.el('#btn-guide').addEventListener('click', () => railSelect('guide'));
    this.el('#btn-quick-guide').addEventListener('click', () => this.toggleModal('guide'));
    this.el('#btn-debug').addEventListener('click', () => this.toggleModal('debug'));
    this.el('#hud-candy-pill').addEventListener('click', () => this.toggleModal('candy'));
    this.hudCommunityPill.addEventListener('click', () => {
      this.activeQuestTab = 'community';
      this.toggleModal('quests');
    });
    this.basketBadge = this.el('#basket-badge') as HTMLButtonElement;
    this.basketBadge.addEventListener('click', () => this.toggleModal('market'));

    const baitButtons = this.root.querySelectorAll<HTMLButtonElement>('.hud-bait-btn');
    baitButtons.forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const baitId = btn.getAttribute('data-bait-id');
        if (baitId) this.handleBaitClick(baitId);
      });
    });

    // Modal closing interactions: backdrop click or close button delegation
    this.modalHost.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target === this.modalHost) {
        this.closeModal();
        return;
      }
      const closeBtn = target.closest<HTMLButtonElement>('.modal-close, button[data-action="close"]');
      if (closeBtn) {
        event.stopPropagation();
        this.closeModal();
      }
    });

    // Close modal on Escape key
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.openModal) {
        this.closeModal();
      }
    });

    // Clicking the bubble itself dismisses it early (or opens market if basket is full, or advances bait tutorial)
    const onTutorialBubbleClick = (e: Event) => {
      e.stopPropagation();
      if (this.uiTourStep >= 0) {
        this.advanceUiTour();
        return;
      }
      if (this.economy.basketFull() || this.inBasketTutorial) {
        this.toggleModal('market');
        return;
      }
      if (!this.economy.hasCompletedBaitTutorial() && this.economy.getTutorialCastCount() === 1) {
        this.dismissedFirstEscapeBubble = true;
        this.renderTutorialBubble(this.gameState.getPhase());
        return;
      }
      if (this.baitTutorialStep === 1) {
        this.baitTutorialStep = 2;
        this.renderTutorialBubble(this.gameState.getPhase());
        this.renderHud();
        return;
      }
      if (this.baitTutorialStep === 2) {
        this.openShopForBait('marshmallows');
        return;
      }
      if (this.baitTutorialStep === 4) {
        this.craftingSystem.equipBait('marshmallows');
        return;
      }
      if (this.tutorialBubble.dataset.clothingTip) {
        const itemId = this.tutorialBubble.dataset.clothingTip;
        this.weatherClothingTipId = null;
        this.openClosetForItem(itemId);
        return;
      }
      if (!this.economy.hasSeenCastTutorial()) this.economy.markCastTutorialSeen();
      else if (!this.economy.hasSeenReelTutorial()) this.economy.markReelTutorialSeen();
      this.renderTutorialBubble(this.gameState.getPhase());
    };

    this.tutorialBubble.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.tutorialBubbleText.addEventListener('click', onTutorialBubbleClick);
    this.tutorialBubble.addEventListener('click', onTutorialBubbleClick);

    this.titleStart.addEventListener('click', () => this.dismissTitleScreen());
    this.syncTitleCharacterCards();
    this.titleScreen.querySelectorAll<HTMLButtonElement>('button[data-character-gender]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gender = btn.dataset.characterGender === 'female' ? 'female' : 'male';
        if (this.economy.setCharacterGender(gender)) {
          this.syncTitleCharacterCards();
          this.events.emit('characterGenderChanged', { gender });
        }
      });
    });

    this.bindEvents();
    this.renderHud();
  }

  /** Call every frame. */
  update(): void {
    this.renderHud();
    this.renderPhaseIndicator();
  }

  setLivingWorld(livingWorld: LivingWorldSystem): void {
    this.livingWorld = livingWorld;
    this.maybeOfferWeatherClothing();
  }

  /** Character taps open the same Closet used by the menu button. */
  openCloset(): void {
    if (this.openModal !== 'closet') this.toggleModal('closet');
  }

  private openClosetForItem(id: string): void {
    const item = CLOTHING_CATALOG.find((entry) => entry.id === id);
    if (!item) return;
    this.activeClosetSlotFilter = item.slot;
    this.openCloset();
    this.modalHost.querySelector<HTMLElement>(`button[data-action="buy-clothing"][data-id="${id}"]`)
      ?.scrollIntoView({ block: 'center' });
  }

  private maybeOfferWeatherClothing(): void {
    if (!this.livingWorld || this.openModal || !this.titleScreen.classList.contains('hidden') ||
        !this.economy.hasCompletedBaitTutorial() || !this.economy.hasSeenCastTutorial() ||
        !this.economy.hasSeenReelTutorial() || this.economy.basketFull() || this.inBasketTutorial ||
        !['idle', 'aiming'].includes(this.gameState.getPhase())) return;
    const weather = this.livingWorld.getWeather();
    const id = weather === 'rain' ? 'rain-slicker' :
      weather === 'clear' || weather === 'golden-hour' ? 'straw-hat' : null;
    if (!id) { this.weatherClothingTipId = null; return; }
    if (this.weatherClothingTipId === id) return;
    const hasHat = CLOTHING_CATALOG.some((item) => item.slot === 'hat' && this.economy.ownsClothing(item.id));
    const cost = id === 'straw-hat' ? 60 : 120;
    if ((id === 'straw-hat' && hasHat) || this.economy.ownsClothing(id) ||
        this.economy.snapshot.coins < cost || this.economy.hasSeenWeatherClothingTip(id)) {
      this.weatherClothingTipId = null;
      return;
    }
    this.weatherClothingTipId = id;
    this.economy.markWeatherClothingTipSeen(id);
    this.renderTutorialBubble(this.gameState.getPhase());
  }

  setQuestSystem(questSystem: QuestSystem): void {
    this.questSystem = questSystem;
  }

  setCommunitySystem(communitySystem: CommunitySystem): void {
    this.communitySystem = communitySystem;
    this.renderHud();
  }

  setNarrativeSystem(narrativeSystem: NarrativeSystem): void {
    this.narrativeSystem = narrativeSystem;
  }

  dispose(): void {
    if (this.toastTimeout) window.clearTimeout(this.toastTimeout);
    if (this.catchCardTimeout) window.clearTimeout(this.catchCardTimeout);
    this.root.remove();
  }

  private dismissTitleScreen(): void {
    this.titleScreen?.classList.add('hidden');
    this.maybeOfferWeatherClothing();
  }

  private syncTitleCharacterCards(): void {
    const current = this.economy.characterGender();
    this.titleScreen?.querySelectorAll<HTMLButtonElement>('button[data-character-gender]').forEach((btn) => {
      const active = btn.dataset.characterGender === current;
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-checked', String(active));
    });
  }

  /** The rail's 7 buttons overflow a 496px-tall Twitch panel stacked open — nested behind the
   * bait-can toggle so only one button occupies the rail until the player asks for the rest. */
  private toggleRail(): void {
    this.railExpanded = !this.railExpanded;
    this.railItems.classList.toggle('hidden', !this.railExpanded);
    this.railToggle.setAttribute('aria-expanded', String(this.railExpanded));
  }

  private collapseRail(): void {
    this.railExpanded = false;
    this.railItems.classList.add('hidden');
    this.railToggle.setAttribute('aria-expanded', 'false');
  }

  /** Shown on the title screen once the viewer has shared their Twitch ID and the EBS resolved a display name. */
  showWelcomeName(name: string): void {
    this.titleWelcome.textContent = `Welcome, ${name}!`;
    this.titleWelcome.classList.remove('hidden');
  }

  /** Drives the title screen's loading bar while hero assets stream in. `ratio` is 0..1. */
  setLoadProgress(ratio: number): void {
    this.titleLoadingFill.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
  }

  /** Enables Cast Off! and hides the loading bar once assets are in (or the safety timeout fires). */
  setReady(): void {
    this.titleLoadingFill.style.width = '100%';
    this.titleLoading.classList.add('hidden');
    this.titleStart.disabled = false;
  }

  private bindEvents(): void {
    this.events.on('toast', ({ message }) => this.showToast(message));
    this.events.on('baitEquipped', ({ id }) => {
      if (this.baitTutorialStep === 4 && id === 'marshmallows') {
        this.economy.markBaitTutorialCompleted();
        this.baitTutorialStep = 0;
        this.renderTutorialBubble(this.gameState.getPhase());
        this.renderHud();
      }
    });
    this.events.on('actionPressed', () => {
      if (this.baitTutorialStep === 1) {
        this.baitTutorialStep = 2;
        this.renderTutorialBubble(this.gameState.getPhase());
        this.renderHud();
      }
    });
    this.events.on('basketFull', () => {
      this.inBasketTutorial = true;
      this.triggerBasketAttention();
    });
    // Tutorial bubbles auto-close the instant the described action actually happens, rather
    // than waiting for the player to notice and dismiss them by hand.
    this.events.on('castLocked', () => {
      this.dismissedFirstEscapeBubble = false;
      if (!this.economy.hasSeenCastTutorial()) this.economy.markCastTutorialSeen();
    });
    this.events.on('biteReacted', () => {
      if (!this.economy.hasSeenReelTutorial()) this.economy.markReelTutorialSeen();
    });
    this.events.on('missed', ({ reason }) => {
      // Reeling in early during 'waiting' is itself a tap-to-reel action.
      if ((reason === 'reeled-early' || reason === 'bait-stolen') && !this.economy.hasSeenReelTutorial()) {
        this.economy.markReelTutorialSeen();
      }
    });
    this.events.on('biteStarted', ({ fightValue, skillValue }) => {
      const margin = skillValue - fightValue;
      this.biteLabel =
        margin > 20 ? 'Easy catch — reel whenever!' : margin > -10 ? "It's fighting back!" : "It's fighting HARD!";
      this.showBiteFlash();
    });
    this.events.on('missed', ({ reason }) => {
      this.missedLabel =
        reason === 'escaped' ? 'It broke free!' :
        reason === 'bait-stolen' ? 'It stole your bait and bolted!' :
        reason === 'no-catch' ? 'It slipped off the hook!' :
        reason === 'reeled-early' ? 'Reeled in early.' :
        'It got away&hellip;';
    });
    this.events.on('catchResolved', ({ result }) => {
      this.showCatchCard(result);
    });
    this.events.on('coinTossTriggered', ({ baitId, baitName }) => {
      if (this.catchCardTimeout) {
        window.clearTimeout(this.catchCardTimeout);
        this.catchCardTimeout = null;
      }
      this.catchCard.classList.add('hidden');
      this.startBaitCoinToss(baitId, baitName);
    });
    this.events.on('coinsChanged', () => { this.refreshOpenModal(); this.maybeOfferWeatherClothing(); });
    this.events.on('phaseChanged', ({ phase }) => {
      if (phase === 'idle' || phase === 'aiming') this.maybeOfferWeatherClothing();
    });
    this.events.on('upgradePurchased', () => this.refreshOpenModal());
    this.events.on('skillPointSpent', () => this.refreshOpenModal());
    this.events.on('baitPurchased', () => {
      this.refreshOpenModal();
      this.renderHud();
    });
    this.events.on('baitEquipped', () => {
      this.refreshOpenModal();
      this.renderHud();
    });
    this.events.on('fishbotPurchased', () => this.refreshOpenModal());
    this.events.on('fishbotClaimed', () => this.refreshOpenModal());
    this.events.on('candyBarsChanged', () => this.refreshOpenModal());
    this.events.on('premiumItemPurchased', ({ id, ok }) => {
      if (ok) this.wearNewClosetItem(id);
      this.refreshOpenModal();
    });
    this.events.on('materialBundlePurchased', () => this.refreshOpenModal());
    this.events.on('boxOfNotFishOpened', () => this.refreshOpenModal());
    this.events.on('clothingPurchased', ({ id, ok }) => {
      if (ok) this.wearNewClosetItem(id);
      this.refreshOpenModal();
    });
    this.events.on('clothingEquipped', () => this.refreshOpenModal());
    this.events.on('baseToneChanged', () => this.refreshOpenModal());
    this.events.on('marketSold', () => {
      this.refreshOpenModal();
    });
    this.events.on('castLocked', ({ precision, rolls }) => {
      if (precision > 0.95) {
        this.showPerfectCastFireworks();
      }
      this.showDiceRolls(rolls.L, rolls.T, rolls.S);
    });
    this.events.on('fishbotToggled', ({ enabled, name }) => {
      if (enabled) {
        this.fishbotStatus.textContent = `Fishingbot ${name} is on. Click anywhere to turn off.`;
        this.fishbotStatus.classList.remove('hidden');
      } else {
        this.fishbotStatus.classList.add('hidden');
      }
    });

    let staggerCount = 0;
    let staggerTimeout: number | null = null;

    this.events.on('trashRecycled', ({ result, catchId }) => {
      const currentStagger = staggerCount++;
      setTimeout(() => {
        this.showRecycleRollText(result, catchId);
      }, currentStagger * 200);
      
      if (staggerTimeout) clearTimeout(staggerTimeout);
      staggerTimeout = window.setTimeout(() => {
        staggerCount = 0;
      }, 400);
    });

    this.events.on('recycleFinished', ({ successCount, failCount, salvaged }) => {
      const totalCount = successCount + failCount;
      const delay = Math.max(1200, totalCount * 200 + 1800);
      setTimeout(() => {
        this.showRecycleSummary(successCount, failCount, salvaged);
      }, delay);
    });

    this.events.on('chapterCompleted', () => {
      this.refreshOpenModal();
      this.renderHud();
    });
    this.events.on('questCompleted', () => {
      this.refreshOpenModal();
      this.renderHud();
    });
    this.events.on('milestoneClaimed', () => {
      this.refreshOpenModal();
      this.renderHud();
    });
    this.events.on('weatherChanged', () => {
      this.renderHud();
      this.maybeOfferWeatherClothing();
    });
    this.events.on('whaleJump', () => {
      this.showToast('🐋 A Great Whale breaches in the distance!');
      this.renderHud();
    });
    this.events.on('krakenBreach', () => {
      this.showToast('🦑 An Ancient Kraken Tentacle surges from the abyss!');
      this.renderHud();
    });
    this.events.on('communityProgressUpdated', ({ contributor, current, target }) => {
      this.renderHud();
      if (this.openModal === 'quests' && this.activeQuestTab === 'community') {
        this.renderQuests();
      }
      if (contributor) {
        this.showRaidTicker(`⚓ ${contributor} contributed to the channel raid! (${current}/${target})`);
      }
    });
    this.events.on('communityGoalCompleted', ({ name, rewards }) => {
      this.renderHud();
      this.refreshOpenModal();
      this.showToast(`🏆 RAID CONQUERED: "${name}"! Unlocked Title: "${rewards.title}"! 🎉`);
    });
    this.events.on('loreBottleDiscovered', ({ bottle }) => {
      this.refreshOpenModal();
      this.showToast(`🍾 Message in a Bottle: "${bottle.title}"! Read in Lore Journal 📖`);
      this.audio.getSynthesizer().playFanfare();
    });
    this.events.on('curioRelicDiscovered', ({ relic }) => {
      this.refreshOpenModal();
      this.showToast(`✨ Relic Recovered: "${relic.name}"! +Perk unlocked 🏺`);
      this.audio.getSynthesizer().playStreakCheer();
    });
  }

  private showDiceRolls(L: number, T: number, S: number): void {
    const dice = document.createElement('div');
    dice.className = 'dice-rolls-anim';
    dice.innerHTML = `L<span>${L}</span> T<span>${T}</span> S<span>${S}</span>`;
    dice.style.left = '50%';
    dice.style.top = `${window.innerHeight - 130}px`;

    document.body.appendChild(dice);
    setTimeout(() => dice.remove(), 2000);
  }

  private showPerfectCastFireworks(): void {
    const fw = document.createElement('div');
    fw.className = 'perfect-cast-fireworks';
    fw.textContent = 'THE PERFECT CAST';
    document.body.appendChild(fw);
    setTimeout(() => fw.remove(), 3000);
  }

  private showRecycleRollText(result: RecycleResult, _catchId: string): void {
    const el = document.createElement('div');
    el.className = 'recycle-roll-anim';
    
    const winNumbersText = result.targetLimit === 6 ? '1-6' : '1-8.5';
    const rollClass = result.success ? 'success-roll' : 'failed-roll';
    const outcomeText = result.success ? 'Success' : 'Dust';
    
    el.innerHTML = `[${winNumbersText}] Roll: <span class="${rollClass}">${result.roll.toFixed(1)}</span> (${outcomeText})`;
    
    const randomDriftX = (Math.random() - 0.5) * 320;
    el.style.setProperty('--drift-x', String(randomDriftX));
    
    const modalBody = this.modalHost.querySelector('.modal-body');
    if (modalBody) {
      const rect = modalBody.getBoundingClientRect();
      el.style.left = `${rect.left + rect.width / 2}px`;
      el.style.top = `${rect.top + rect.height / 2}px`;
    } else {
      el.style.left = '50%';
      el.style.top = '40%';
    }
    
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  private showRecycleSummary(successCount: number, failCount: number, salvaged: Record<string, number>): void {
    const card = document.createElement('div');
    card.className = 'recycle-summary-card';
    
    let materialMarkup = '';
    if (successCount > 0) {
      materialMarkup = Object.entries(salvaged)
        .map(([mat, amount]) => `
          <div class="recycle-summary-item">
            <span>${mat.toUpperCase()}</span>
            <strong>+${amount}</strong>
          </div>
        `)
        .join('');
    } else {
      materialMarkup = '<div class="recycle-summary-empty">No materials salvaged</div>';
    }
    
    card.innerHTML = `
      <div class="recycle-summary-header">Recycle Report</div>
      <div class="recycle-summary-body">
        ${materialMarkup}
      </div>
      <div class="recycle-summary-footer">
        ${failCount > 0 ? `<span>Dissolved: ${failCount}</span>` : '<span>Perfect salvage!</span>'}
        <button class="btn-small btn-primary" id="btn-close-recycle-report">Ok</button>
      </div>
    `;
    
    document.body.appendChild(card);
    
    card.querySelector('#btn-close-recycle-report')?.addEventListener('click', () => {
      card.classList.remove('visible');
      setTimeout(() => card.remove(), 300);
    });
    
    setTimeout(() => card.classList.add('visible'), 10);
    
    setTimeout(() => {
      if (card.parentNode) {
        card.classList.remove('visible');
        setTimeout(() => card.remove(), 300);
      }
    }, 2000);
  }

  private renderHud(): void {
    const state = this.economy.snapshot;
    this.hudLevel.textContent = `Lv ${state.level}`;
    const needed = xpToNextLevel(state.level);
    this.hudXpFill.style.width = `${Math.min(100, (state.xp / needed) * 100)}%`;
    this.hudCoins.textContent = String(state.coins);
    this.hudCandyBars.textContent = String(state.candyBars);
    this.hudBasketCount.textContent = `${state.basket.length}/${this.economy.basketCapacity()}`;

    // Update right-side bait selector buttons
    const baitLocked = !['idle', 'aiming'].includes(this.gameState.getPhase());
    const isBaitTutorialStep2 = this.baitTutorialStep === 2 && !this.economy.hasCompletedBaitTutorial();
    const isBaitTutorialStep4 = this.baitTutorialStep === 4 && !this.economy.hasCompletedBaitTutorial();
    for (const bait of BAIT_CATALOG) {
      const btn = this.root.querySelector<HTMLButtonElement>(`#hud-bait-btn-${bait.id}`);
      const qtyEl = this.root.querySelector<HTMLElement>(`#hud-bait-qty-${bait.id}`);
      if (!btn || !qtyEl) continue;

      const owned = state.baitInventory[bait.id] ?? 0;
      const isSelected = state.equippedBaitId === bait.id;
      const isAvailable = bait.free || owned > 0;

      const qtyText = bait.free ? '∞' : String(owned);
      if (qtyEl.textContent !== qtyText) {
        qtyEl.textContent = qtyText;
      }

      btn.classList.toggle('selected', isSelected);
      btn.classList.toggle('unselected', !isSelected);
      btn.classList.toggle('empty', !isAvailable);
      btn.disabled = baitLocked;

      const isFlashingBait =
        (isBaitTutorialStep2 && bait.id !== 'pleb-bait') ||
        (isBaitTutorialStep4 && bait.id === 'marshmallows');
      btn.classList.toggle('tutorial-flash-stroke', isFlashingBait);

      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      btn.title = `${bait.name} (${bait.free ? 'Free' : `${owned} left`}) - ${baitLocked ? 'Available after this cast' : isSelected ? 'Selected' : isAvailable ? 'Click to equip' : 'Click to buy in shop'}`;
    }

    const isBasketFull = this.economy.basketFull();
    if (isBasketFull) {
      this.inBasketTutorial = true;
      this.basketBadge.classList.add('basket-glow');
    } else {
      this.basketBadge.classList.remove('basket-glow');
      if (state.basket.length === 0) {
        this.inBasketTutorial = false;
      }
    }

    const duckyActive = this.economy.isLuckyDuckyActive();
    const duckyPill = this.root.querySelector('#hud-lucky-ducky-pill');
    if (duckyPill) {
      if (duckyActive) {
        duckyPill.classList.remove('hidden');
        const sec = this.economy.luckyDuckyTimeRemainingSec();
        const mins = Math.floor(sec / 60);
        const secs = String(sec % 60).padStart(2, '0');
        const timerText = duckyPill.querySelector('#hud-lucky-ducky-timer');
        if (timerText) timerText.textContent = `${mins}:${secs}`;
        
        if (sec !== this.lastDuckySecond) {
          this.lastDuckySecond = sec;
          if (this.openModal === 'craft') {
            this.renderCraft();
          }
        }
      } else {
        duckyPill.classList.add('hidden');
        if (this.lastDuckySecond !== 0) {
          this.lastDuckySecond = 0;
          if (this.openModal === 'craft') {
            this.renderCraft();
          }
        }
      }
    }

    if (this.hudStreakPill) {
      const streak = this.economy.catchStreak();
      const text = `🔥 ${streak}`;
      if (this.hudStreakPill.textContent !== text) {
        this.hudStreakPill.textContent = text;
      }
      this.hudStreakPill.classList.toggle('hidden', streak === 0);
    }

    if (this.hudCommunityPill) {
      if (this.communitySystem) {
        const goal = this.communitySystem.getActiveGoal();
        const inCooldown = this.communitySystem.isInCooldown();
        this.hudCommunityPill.classList.remove('hidden');
        if (inCooldown) {
          if (this.hudCommunityText) this.hudCommunityText.textContent = 'Victory! 🎉';
          if (this.hudCommunityFill) this.hudCommunityFill.style.width = '100%';
        } else if (goal) {
          const ratio = this.communitySystem.getProgressRatio();
          const pct = Math.min(100, Math.round(ratio * 100));
          const shortName = goal.bossName.replace('The ', '').split(' ')[0];
          if (this.hudCommunityText) this.hudCommunityText.textContent = `${shortName}: ${pct}%`;
          if (this.hudCommunityFill) this.hudCommunityFill.style.width = `${pct}%`;
        }
      } else {
        this.hudCommunityPill.classList.add('hidden');
      }
    }
  }

  private renderPhaseIndicator(): void {
    const snap = this.gameState.snapshot();

    switch (snap.phase) {
      case 'aiming':
        this.phaseIndicator.innerHTML = this.gaugeMarkup(snap.gaugeValue, snap.sweetSpot, snap.sweetSpotWidth);
        break;
      case 'bite':
        this.phaseIndicator.innerHTML = `<div class="phase-label bite">${this.biteLabel}</div>`;
        break;
      case 'missed':
        this.phaseIndicator.innerHTML = `<div class="phase-label missed">${this.missedLabel}</div>`;
        break;
      default:
        this.phaseIndicator.innerHTML = '';
    }

    this.renderTutorialBubble(snap.phase);
  }

  /**
   * Barnaby's onboarding & guide bubbles:
   * 1. Basket full tutorial directing player to the bottom-left basket badge.
   * 2. "Click to cast" while idle/aiming.
   * 3. "Tap to reel" once cast until the first bite is reacted to.
   */
  private renderTutorialBubble(phase: FishingPhase): void {
    let text: string | null = null;
    let isBasketTutorial = false;
    let showDownTriangle = false;

    const inBaitTutorial = !this.economy.hasCompletedBaitTutorial() && this.economy.getTutorialCastCount() >= 2;
    const isFirstEscapeTutorial =
      !this.economy.hasCompletedBaitTutorial() &&
      this.economy.getTutorialCastCount() === 1 &&
      !this.dismissedFirstEscapeBubble &&
      (phase === 'missed' || phase === 'idle' || phase === 'aiming');

    if (!this.openModal && this.uiTourStep >= 0) {
      const step = this.getUiTourSteps()[this.uiTourStep];
      if (step) {
        text = `(${this.uiTourStep + 1}/${this.getUiTourSteps().length}) ${step.text} Tap to continue.`;
        showDownTriangle = true;
      }
      if (this.lastUiTourHighlightStep !== this.uiTourStep) {
        this.syncUiTourHighlights();
      }
    } else if (!this.openModal && (this.economy.basketFull() || (this.inBasketTutorial && this.economy.snapshot.basket.length > 0))) {
      text = 'Your basket is full! Tap the basket in the bottom left to visit the market.';
      isBasketTutorial = true;
    } else if (!this.openModal && inBaitTutorial) {
      if (this.baitTutorialStep === 0) {
        this.baitTutorialStep = 1;
      }
      if (this.baitTutorialStep === 1) {
        text = "Oh you are using Pleb bait! Won't catch much with those, glurp.";
        showDownTriangle = true;
      } else if (this.baitTutorialStep === 2) {
        text = "Stop by my ba ba bait shop to get some better ba ba bait.";
        showDownTriangle = false;
      } else if (this.baitTutorialStep === 4) {
        text = "Tap your new bait to equip it, glurp.";
        showDownTriangle = false;
      }
    } else if (!this.openModal && isFirstEscapeTutorial) {
      text = "Some getaway, glrup. Keep casting.";
      showDownTriangle = false;
    } else if (!this.openModal && !this.economy.hasSeenCastTutorial() && (phase === 'idle' || phase === 'aiming')) {
      text = 'Click on the screen to cast your reel.';
    } else if (
      !this.openModal &&
      this.economy.hasSeenCastTutorial() &&
      !this.economy.hasSeenReelTutorial() &&
      (phase === 'casting' || phase === 'waiting' || phase === 'bite')
    ) {
      text = 'Once you have a bite, tap the screen to reel in.';
    } else if (!this.openModal && (phase === 'idle' || phase === 'aiming') && this.weatherClothingTipId &&
               !this.economy.ownsClothing(this.weatherClothingTipId)) {
      text = this.weatherClothingTipId === 'rain-slicker'
        ? 'Rain coming down, glurp! Craft a Rain Slicker for 120 coins in your Closet, then equip it. Tap here to find it.'
        : 'Sunny day, glurp! Craft a Straw Hat for 60 coins in your Closet, then equip it. Tap here to find it.';
    }

    if (text) {
      if (this.tutorialBubbleContent.textContent !== text) {
        this.tutorialBubbleContent.textContent = text;
      }
      this.tutorialBubble.dataset.clothingTip = text.includes('Tap here to find it.') ? this.weatherClothingTipId ?? '' : '';
      this.tutorialBubble.classList.remove('hidden');
      if (showDownTriangle) {
        this.tutorialDownTriangle.classList.remove('hidden');
      } else {
        this.tutorialDownTriangle.classList.add('hidden');
      }
      if (isBasketTutorial) {
        this.tutorialBubble.classList.add('basket-tutorial');
      } else {
        this.tutorialBubble.classList.remove('basket-tutorial');
      }
    } else {
      this.tutorialBubbleContent.textContent = '';
      this.tutorialBubble.dataset.clothingTip = '';
      this.tutorialDownTriangle.classList.add('hidden');
      this.tutorialBubble.classList.add('hidden');
      this.tutorialBubble.classList.remove('basket-tutorial');
    }
  }

  private triggerBasketAttention(): void {
    this.tutorialBubble.classList.remove('attention');
    void this.tutorialBubble.offsetWidth;
    this.tutorialBubble.classList.add('attention');
    setTimeout(() => {
      this.tutorialBubble.classList.remove('attention');
    }, 1000);
  }

  private gaugeMarkup(value: number, sweetSpot: number, width: number): string {
    const sweetLeft = Math.max(0, (sweetSpot - width) * 100);
    const sweetWidth = Math.min(100, width * 2 * 100);
    const perfectLeft = sweetSpot * 100 - 1;
    const perfectWidth = 2;
    return `
      <div class="phase-label">Tap to lock the cast!</div>
      <div class="gauge-track">
        <div class="gauge-sweet" style="left:${sweetLeft}%;width:${sweetWidth}%"></div>
        <div class="gauge-perfect" style="left:${perfectLeft}%;width:${perfectWidth}%"></div>
        <div class="gauge-needle" style="left:${value * 100}%"></div>
      </div>
    `;
  }

  private showToast(message: string): void {
    this.toastLine.textContent = message;
    this.toastLine.classList.remove('hidden');
    if (this.toastTimeout) window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => this.toastLine.classList.add('hidden'), 2200);
  }

  private showRaidTicker(message: string): void {
    this.raidTickerQueue.push(message);
    if (this.raidTicker.classList.contains('hidden')) this.advanceRaidTicker();
  }

  private advanceRaidTicker(): void {
    const message = this.raidTickerQueue.shift();
    if (!message) {
      this.raidTicker.classList.add('hidden');
      return;
    }
    this.raidTicker.classList.remove('hidden');
    this.raidTickerText.textContent = message;
    this.raidTickerText.style.setProperty('--ticker-duration', `${Math.max(5, Math.min(10, message.length * 0.09))}s`);
    // Restart the strip for the next contribution without moving its container.
    void this.raidTickerText.offsetWidth;
    this.raidTickerText.classList.add('scrolling');
  }

  /** Brief pulsing border cue when a bite starts. */
  private showBiteFlash(): void {
    this.biteFlash.classList.remove('flashing');
    // Force a reflow so re-triggering while already flashing restarts the animation.
    void this.biteFlash.offsetWidth;
    this.biteFlash.classList.add('flashing');
  }

  /**
   * "BITE" pop text that originates small at the bobber's screen position (`x`, `y` in CSS
   * pixels) and zooms bigger while fading — see Game.ts's `biteStarted` handler for the
   * world-to-screen projection that supplies the coordinates.
   */
  showBiteText(x: number, y: number): void {
    const el = document.createElement('div');
    el.className = 'bite-pop';
    el.textContent = 'BITE!';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.addEventListener('animationend', () => el.remove());
    this.root.appendChild(el);
  }

  private showCatchCard(result: CatchResult): void {
    const rarityLabel = result.rarity.toUpperCase();
    const sprite = spriteFor(result.catchId);
    this.catchCard.innerHTML = `
      <div class="catch-card-inner rarity-${result.rarity}">
        ${sprite ? icon(sprite, result.name, 'catch-sprite') : ''}
        <div class="catch-rarity">${rarityLabel}</div>
        <div class="catch-name">${result.name}</div>
        <div class="catch-weight">${result.weightKg.toFixed(2)} kg</div>
        <div class="catch-flavor">${result.flavor}</div>
        <div class="catch-xp">+${result.xpAwarded} XP${result.isTrash ? '' : ` &middot; worth ~${result.value}${icon(ICON.coin, 'coins', 'inline-icon')}`}</div>
        ${!result.addedToBasket ? '<div class="catch-warn">Basket was full — this one got away!</div>' : ''}
      </div>
    `;
    this.catchCard.classList.remove('hidden');
    if (this.catchCardTimeout) window.clearTimeout(this.catchCardTimeout);
    this.catchCardTimeout = window.setTimeout(() => this.catchCard.classList.add('hidden'), 2400);
  }

  private startBaitCoinToss(_baitId: string, baitName: string): void {
    if (this.coinTossTimeout) {
      window.clearTimeout(this.coinTossTimeout);
      this.coinTossTimeout = null;
    }

    this.coinTossOverlay.innerHTML = `
      <div class="coin-card" id="coin-card">
        <h3 class="coin-title">Bait Saver Toss!</h3>
        <p class="coin-subtitle">Flip to see if your <strong>${baitName}</strong> is lost!</p>
        <div class="coin-rules-bar">
          <span class="coin-rule-heads">🪙 Heads: <strong>Barnaby</strong> (Saved)</span>
          <span class="coin-rule-sep">&bull;</span>
          <span class="coin-rule-tails">💋 Tails: <strong>Catfish</strong> (Lost)</span>
        </div>
        <div class="coin-viewport" id="coin-viewport">
          <div class="coin-3d" id="coin-3d">
            <div class="coin-face coin-front">
              <img class="coin-face-img" src="./images/barnaby-portrait.png" alt="Barnaby" />
              <span class="coin-face-tag tag-barnaby">Barnaby (Heads)</span>
            </div>
            <div class="coin-face coin-back">
              <img class="coin-face-img" src="./images/catfish-portrait.png" alt="Catfish with pretty lips" />
              <span class="coin-face-tag tag-catfish">Catfish (Tails)</span>
            </div>
          </div>
        </div>
        <div class="coin-result-message hidden" id="coin-result-message"></div>
        <div class="coin-actions">
          <button class="btn-primary coin-flip-btn" id="btn-coin-flip" type="button">Flip Coin! 🪙</button>
        </div>
      </div>
    `;
    this.coinTossOverlay.classList.remove('hidden');

    const flipBtn = this.coinTossOverlay.querySelector<HTMLButtonElement>('#btn-coin-flip');
    const coin3d = this.coinTossOverlay.querySelector<HTMLElement>('#coin-3d');
    const resultMsg = this.coinTossOverlay.querySelector<HTMLElement>('#coin-result-message');

    let flipped = false;

    const executeFlip = () => {
      if (flipped) return;
      flipped = true;
      if (flipBtn) {
        flipBtn.disabled = true;
        flipBtn.textContent = 'Flipping...';
      }

      // Random 50/50: true = heads (Barnaby / Saved), false = tails (Catfish / Lost)
      const isSaved = Math.random() < 0.5;

      if (coin3d) {
        coin3d.classList.add(isSaved ? 'flipping-to-barnaby' : 'flipping-to-catfish');
      }

      setTimeout(() => {
        if (!resultMsg) return;
        resultMsg.classList.remove('hidden');

        if (isSaved) {
          resultMsg.className = 'coin-result-message coin-result-saved';
          resultMsg.innerHTML = `<strong>Barnaby wins!</strong> Your ${baitName} was saved! 🎉`;
          this.gameState.finishCoinToss(false);
          this.renderHud();
        } else {
          resultMsg.className = 'coin-result-message coin-result-lost';
          resultMsg.innerHTML = `<strong>Pretty Catfish wins!</strong> 💋 Chomp! ${baitName} was lost.`;
          this.gameState.finishCoinToss(true);
          this.renderHud();
        }

        if (flipBtn) {
          flipBtn.disabled = false;
          flipBtn.textContent = 'Continue';
          flipBtn.onclick = () => closeOverlay();
        }

        this.coinTossTimeout = window.setTimeout(() => {
          closeOverlay();
        }, 1800);
      }, 1250);
    };

    const closeOverlay = () => {
      if (this.coinTossTimeout) {
        window.clearTimeout(this.coinTossTimeout);
        this.coinTossTimeout = null;
      }
      this.coinTossOverlay.classList.add('hidden');
      this.coinTossOverlay.innerHTML = '';
      this.gameState.finishCoinTossOverlay();
    };

    flipBtn?.addEventListener('click', executeFlip);
    coin3d?.addEventListener('click', executeFlip);

    if (this.gameState.autoFishingEnabled) {
      setTimeout(() => {
        if (!flipped) executeFlip();
      }, 400);
    }
  }

  public closeModal(): void {
    if (!this.openModal) return;
    const previous = this.openModal;
    this.openModal = null;
    if (previous === 'candy') this.returnToClosetFromCandy = false;
    if (previous === 'closet') {
      this.previewClothingId = null;
      this.events.emit('closetClosed', {});
    }
    if (previous === 'shop') this.handleShopClosed();
    this.resetArmed = false;
    this.debugResetArmed = false;
    this.scrapbookOpened = false;
    this.renderModal();
    this.maybeOfferWeatherClothing();
  }

  private toggleModal(id: ModalId): void {
    if (this.openModal === id) {
      this.closeModal();
      return;
    }
    const previous = this.openModal;
    this.openModal = id;
    if (previous === 'candy' && id !== 'closet') this.returnToClosetFromCandy = false;
    if (this.openModal === 'collection') this.scrapbookOpened = false;
    if (this.openModal === 'market') this.marketSystem.onMarketOpened();
    if (previous === 'closet' && this.openModal !== 'closet') {
      this.previewClothingId = null;
      this.events.emit('closetClosed', {});
    }
    if (this.openModal === 'closet' && previous !== 'closet') this.events.emit('closetOpened', {});
    if (previous === 'shop' && this.openModal !== 'shop') this.handleShopClosed();
    this.resetArmed = false;
    this.debugResetArmed = false;
    this.renderModal();
  }

  private handleShopClosed(): void {
    if (!this.economy.hasCompletedBaitTutorial() && this.economy.getTutorialCastCount() >= 2) {
      const hasMarshmallows = (this.economy.snapshot.baitInventory['marshmallows'] ?? 0) > 0;
      if (hasMarshmallows) {
        if (this.economy.snapshot.equippedBaitId === 'marshmallows') {
          this.economy.markBaitTutorialCompleted();
          this.baitTutorialStep = 0;
        } else {
          this.baitTutorialStep = 4;
        }
      } else {
        this.baitTutorialStep = 2;
      }
      this.renderTutorialBubble(this.gameState.getPhase());
      this.renderHud();
    }
  }

  private refreshOpenModal(): void {
    if (this.openModal) this.renderModal();
  }

  private renderModal(): void {
    if (!this.openModal) {
      this.modalHost.classList.add('hidden');
      this.modalHost.innerHTML = '';
      return;
    }
    // Every render*() below does a full innerHTML rebuild, which resets scroll to the top —
    // jarring when an action (e.g. a failed purchase) re-renders the same modal the player was
    // scrolled through. Preserve it across the rebuild.
    const scrollTop = this.modalHost.querySelector('.modal-body')?.scrollTop ?? 0;
    this.modalHost.classList.remove('hidden');
    if (this.openModal === 'shop') this.renderShop();
    else if (this.openModal === 'market') this.renderMarket();
    else if (this.openModal === 'craft') this.renderCraft();
    else if (this.openModal === 'candy') this.renderCandyShop();
    else if (this.openModal === 'closet') this.renderCloset();
    else if (this.openModal === 'collection') this.renderCollection();
    else if (this.openModal === 'settings') this.renderSettings();
    else if (this.openModal === 'skills') this.renderSkills();
    else if (this.openModal === 'quests') this.renderQuests();
    else if (this.openModal === 'guide') this.renderGuide();
    else if (this.openModal === 'debug') this.renderDebug();
    const newModalBody = this.modalHost.querySelector('.modal-body');
    if (newModalBody) newModalBody.scrollTop = scrollTop;
  }

  private renderQuests(): void {
    if (!this.questSystem) return;

    this.questSystem.ensureDailyQuests();
    const activeChapter = this.questSystem.getActiveChapter();
    const dailyQuests = this.questSystem.getDailyQuests();
    const milestones = this.questSystem.getMilestones();
    const state = this.economy.snapshot;

    const uncompletedDailyClaims = dailyQuests.filter((q) => q.completed && !q.claimed).length;

    const tabsMarkup = `
      <div class="quest-tabs">
        <button class="quest-tab-btn ${this.activeQuestTab === 'story' ? 'active' : ''}" data-action="switch-quest-tab" data-id="story">📜 Story Chronicles</button>
        <button class="quest-tab-btn ${this.activeQuestTab === 'daily' ? 'active' : ''}" data-action="switch-quest-tab" data-id="daily">⭐ Daily Quests ${uncompletedDailyClaims > 0 ? `(${uncompletedDailyClaims}!)` : ''}</button>
        <button class="quest-tab-btn ${this.activeQuestTab === 'milestones' ? 'active' : ''}" data-action="switch-quest-tab" data-id="milestones">🏆 Milestones</button>
        <button class="quest-tab-btn ${this.activeQuestTab === 'perks' ? 'active' : ''}" data-action="switch-quest-tab" data-id="perks">⚡ Perks & Prestige</button>
        <button class="quest-tab-btn ${this.activeQuestTab === 'community' ? 'active' : ''}" data-action="switch-quest-tab" data-id="community">⚔️ Boss Raids</button>
        <button class="quest-tab-btn ${this.activeQuestTab === 'lore' ? 'active' : ''}" data-action="switch-quest-tab" data-id="lore">📖 Lore & Relics</button>
      </div>
    `;

    let contentMarkup = '';

    if (this.activeQuestTab === 'story') {
      const isCompleted = this.questSystem.isChapterCompleted(activeChapter.id);
      const canClaim = this.questSystem.canClaimChapter(activeChapter.id);

      const objectivesMarkup = activeChapter.objectives.map((obj) => {
        let current = this.questSystem!.getChapterProgress(obj.id);
        if (obj.type === 'reach_level') current = state.level;
        const progressClamped = Math.min(obj.target, current);
        const percent = Math.min(100, Math.round((progressClamped / obj.target) * 100));
        const done = current >= obj.target;

        return `
          <div class="quest-objective-row">
            <div class="quest-objective-info">
              <span>${done ? '✓ ' : ''}${obj.description}</span>
              <span><strong>${progressClamped}</strong> / ${obj.target}</span>
            </div>
            <div class="quest-progress-track">
              <div class="quest-progress-fill ${done ? 'completed' : ''}" style="width: ${percent}%"></div>
            </div>
          </div>
        `;
      }).join('');

      const rewardParts: string[] = [
        `+${activeChapter.rewards.coins}🪙`,
        `+${activeChapter.rewards.xp} XP`,
      ];
      if (activeChapter.rewards.candyBars && !this.economy.usesServerCandy) {
        rewardParts.push(`+${activeChapter.rewards.candyBars} ${CANDY_EMOJI}`);
      }
      if (activeChapter.rewards.titleReward) {
        rewardParts.push(`Title: "${activeChapter.rewards.titleReward}"`);
      }
      if (activeChapter.rewards.bait) {
        rewardParts.push(`${activeChapter.rewards.bait.count}x ${activeChapter.rewards.bait.id}`);
      }

      const chapterListMarkup = STORY_CHAPTERS.map((ch) => {
        const completed = this.questSystem!.isChapterCompleted(ch.id);
        const isCurrent = ch.id === activeChapter.id;
        const statusClass = completed ? 'ch-completed' : isCurrent ? 'ch-active' : 'ch-locked';
        const icon = completed ? '✓' : isCurrent ? '▶' : '🔒';
        return `
          <div class="chapter-index-pill ${statusClass}">
            <span>${icon} Ch. ${ch.chapterNumber}: ${ch.title}</span>
          </div>
        `;
      }).join('');

      contentMarkup = `
        <div class="story-chapter-card">
          <div class="story-chapter-header">
            <span class="story-chapter-num">Chapter ${activeChapter.chapterNumber} of ${STORY_CHAPTERS.length}</span>
            <span class="story-chapter-title">${activeChapter.title}</span>
          </div>
          <div class="story-chapter-subtitle">${activeChapter.subtitle}</div>
          <div class="story-lore-quote">&ldquo;${activeChapter.barnabyIntroDialogue}&rdquo; <br>&mdash; <em>Old Barnaby</em></div>

          <div class="story-objectives-list">
            ${objectivesMarkup}
          </div>

          <div class="quest-reward-banner">
            <div class="quest-reward-tags">
              Rewards: ${rewardParts.join(' &middot; ')}
            </div>
            <div>
              ${
                isCompleted
                  ? '<span class="claimed-badge">Completed ✓</span>'
                  : `<button class="btn-small ${!canClaim ? 'btn-disabled' : 'btn-primary'}" data-action="claim-chapter" data-id="${activeChapter.id}" ${!canClaim ? 'disabled' : ''}>Claim Chapter Reward</button>`
              }
            </div>
          </div>
        </div>

        <h4 class="modal-subhead">Story Journey</h4>
        <div class="chapter-roadmap">
          ${chapterListMarkup}
        </div>
      `;
    } else if (this.activeQuestTab === 'daily') {
      const rows = dailyQuests.map((q) => {
        const percent = Math.min(100, Math.round((q.progress / q.target) * 100));
        const canClaim = q.completed && !q.claimed;
        return `
          <li class="row daily-quest-row">
            <div class="row-body">
              <div class="daily-quest-header">
                <strong>${q.title}</strong>
                <span class="row-meta">${q.progress}/${q.target}</span>
              </div>
              <span class="row-meta">${q.description}</span>
              <div class="quest-progress-track">
                <div class="quest-progress-fill ${q.completed ? 'completed' : ''}" style="width: ${percent}%"></div>
              </div>
              <span class="row-meta reward-line">Reward: +${q.reward.coins}🪙, +${q.reward.xp} XP${q.reward.candyBars && !this.economy.usesServerCandy ? `, +${q.reward.candyBars} ${CANDY_EMOJI}` : ''}</span>
            </div>
            <div class="row-actions">
              ${
                q.claimed
                  ? '<span class="claimed-badge">Claimed ✓</span>'
                  : canClaim
                  ? `<button class="btn-small btn-primary" data-action="claim-daily-quest" data-id="${q.id}">Claim</button>`
                  : `<button class="btn-micro btn-secondary" data-action="reroll-daily-quest" data-id="${q.id}" title="Reroll this quest for a new goal">🎲 Reroll</button>`
              }
            </div>
          </li>
        `;
      }).join('');

      contentMarkup = `
        <div class="craft-header">
          <strong>Daily Stream Goals</strong>
          <span class="modal-note">Fresh tasks every stream session. Earn coins, XP, and Candy Bars!</span>
        </div>
        <ul class="modal-list">${rows}</ul>
      `;
    } else if (this.activeQuestTab === 'milestones') {
      const rows = milestones.map((m) => {
        const claimed = this.questSystem!.isMilestoneClaimed(m.id);
        const canClaim = this.questSystem!.canClaimMilestone(m.id);
        let current = 0;
        switch (m.category) {
          case 'catches': current = state.totalFishCaught ?? 0; break;
          case 'weight': current = state.totalWeightKgCaught ?? 0; break;
          case 'species': current = state.discoveredCatchIds.length; break;
          case 'salvage': current = state.totalTrashRecycled ?? 0; break;
        }
        const percent = Math.min(100, Math.round((Math.min(m.target, current) / m.target) * 100));
        const badgeClass = m.tierName.toLowerCase();

        return `
          <li class="row milestone-row">
            <div class="row-body">
              <div class="milestone-title-line">
                <span class="milestone-badge badge-${badgeClass}">${m.tierName}</span>
                <strong>${m.name}</strong>
                <span class="milestone-category">(${m.category})</span>
              </div>
              <span class="row-meta">${m.description} (${current}/${m.target})</span>
              <div class="quest-progress-track">
                <div class="quest-progress-fill ${current >= m.target ? 'completed' : ''}" style="width: ${percent}%"></div>
              </div>
              <span class="row-meta reward-line">Reward: +${m.reward.coins}🪙, +${m.reward.xp} XP${m.reward.candyBars && !this.economy.usesServerCandy ? `, +${m.reward.candyBars} ${CANDY_EMOJI}` : ''}</span>
            </div>
            <div class="row-actions">
              ${
                claimed
                  ? '<span class="claimed-badge">Claimed ✓</span>'
                  : `<button class="btn-small ${!canClaim ? 'btn-disabled' : 'btn-primary'}" data-action="claim-milestone" data-id="${m.id}" ${!canClaim ? 'disabled' : ''}>Claim</button>`
              }
            </div>
          </li>
        `;
      }).join('');

      contentMarkup = `
        <div class="craft-header">
          <strong>Mastery Milestones</strong>
          <span class="modal-note">Long-term achievements tracking your entire fishing career.</span>
        </div>
        <ul class="modal-list">${rows}</ul>
      `;
    } else if (this.activeQuestTab === 'perks') {
      const currentLevel = state.level;
      const prestigeLevel = this.economy.prestige();
      const canPrestige = this.economy.canPrestige();
      const equippedTitle = this.economy.equippedTitle();
      const unlockedTitles = this.economy.unlockedTitles();

      const perkRows = LEVEL_PERKS.map((perk) => {
        const unlocked = currentLevel >= perk.level;
        return `
          <div class="perk-card ${unlocked ? 'unlocked' : 'locked'}">
            <div class="perk-header">
              <span>${unlocked ? (perk.badge ?? '⚡') : '🔒'} Lv ${perk.level}: ${perk.name}</span>
              <span class="perk-status">${unlocked ? 'Active' : 'Locked'}</span>
            </div>
            <div class="row-meta">${perk.description}</div>
          </div>
        `;
      }).join('');

      const titleButtons = unlockedTitles.map((title) => {
        const isEquipped = title === equippedTitle;
        const safeTitle = escapeWalletText(title);
        return `
          <button class="btn-small ${isEquipped ? 'btn-primary' : 'btn-secondary'}" data-action="equip-title" data-id="${safeTitle}">
            ${isEquipped ? '✓ ' : ''}${safeTitle}
          </button>
        `;
      }).join('');

      contentMarkup = `
        <div class="prestige-banner">
          <div class="prestige-info">
            <strong>Prestige Rank: ${prestigeLevel}</strong>
            <span class="row-meta">${prestigeLevel > 0 ? `Honored Angler (Prestige ${prestigeLevel})` : 'Reach Level 50 to Prestige and ascend to legendary status.'}</span>
          </div>
          <div class="row-actions">
            <button class="btn-small ${!canPrestige ? 'btn-disabled' : 'btn-primary'}" data-action="prestige" ${!canPrestige ? 'disabled' : ''}>Ascend (Prestige)</button>
          </div>
        </div>

        ${unlockedTitles.length > 0 ? `
          <h4 class="modal-subhead">Player Titles</h4>
          <div class="titles-flow">
            ${titleButtons}
          </div>
        ` : ''}

        <h4 class="modal-subhead">Level Perk Progression</h4>
        <div class="perks-list">
          ${perkRows}
        </div>
      `;
    } else if (this.activeQuestTab === 'community') {
      const activeGoal = this.communitySystem ? this.communitySystem.getActiveGoal() : null;
      const progressRatio = this.communitySystem ? this.communitySystem.getProgressRatio() : 0;
      const percent = Math.min(100, Math.round(progressRatio * 100));
      const inCooldown = this.communitySystem ? this.communitySystem.isInCooldown() : false;
      const cooldownSecs = this.communitySystem ? Math.ceil(this.communitySystem.getCooldownRemaining()) : 0;
      const completedRaidsCount = this.economy.totalCommunityGoalsCompleted();

      if (inCooldown) {
        contentMarkup = `
          <div class="community-boss-card victory-card">
            <div class="community-boss-header">
              <span class="community-boss-badge">VICTORY 🎉</span>
              <strong class="community-boss-title">Boss Defeated!</strong>
            </div>
            <p class="modal-note">The channel united and conquered the waters! Scouting for next boss raid in <strong>${cooldownSecs}s</strong>...</p>
            <div class="row-actions" style="margin-top: 12px;">
              <button class="btn-small btn-primary" data-action="spawn-next-raid">Spawn Next Raid Now</button>
            </div>
          </div>
        `;
      } else if (activeGoal) {
        const cheerPacks = activeGoal.cheerPacks ?? [];
        const cheerMarkup = cheerPacks.map((pack) => {
          const userCandy = this.economy.snapshot.candyBars;
          const canAfford = !this.economy.usesServerCandy && userCandy >= pack.costCandyBars;
          return `
            <div class="cheer-pack-card">
              <div class="cheer-pack-info">
                <strong>${pack.name}</strong>
                <span class="cheer-boost">+${pack.progressBoost} ${activeGoal.category === 'weight' ? 'kg' : 'progress'}</span>
                <span class="row-meta">${pack.description}</span>
              </div>
              <button class="btn-small ${canAfford ? 'btn-primary' : 'btn-disabled'}" data-action="buy-community-cheer" data-id="${pack.id}" ${canAfford ? '' : 'disabled'}>
                ${this.economy.usesServerCandy ? 'Unavailable on Twitch' : `${pack.costCandyBars} ${CANDY_EMOJI}`}
              </button>
            </div>
          `;
        }).join('');

        contentMarkup = `
          <div class="community-boss-card">
            <div class="community-boss-header">
              <span class="community-boss-badge">Active Channel Raid</span>
              <strong class="community-boss-title">${activeGoal.name}</strong>
              <span class="community-boss-category">Category: ${activeGoal.category.toUpperCase()}</span>
            </div>
            <p class="modal-note">${activeGoal.description}</p>
            <div class="quest-objective-row">
              <div class="quest-objective-info">
                <span>Progress: <strong>${activeGoal.currentValue}</strong> / ${activeGoal.targetValue} ${activeGoal.category === 'weight' ? 'kg' : ''}</span>
                <span><strong>${percent}%</strong></span>
              </div>
              <div class="quest-progress-track">
                <div class="quest-progress-fill ${percent >= 100 ? 'completed' : ''}" style="width: ${percent}%"></div>
              </div>
            </div>

            <h4 class="modal-subhead">Raid Boosts (Candy Bars)</h4>
            <div class="cheer-packs-grid">
              ${cheerMarkup}
            </div>

            <h4 class="modal-subhead">Victory Rewards for All Participants</h4>
            <div class="community-rewards-box">
              <span>+${activeGoal.completionRewards.coins}🪙</span>
              <span>+${activeGoal.completionRewards.xp} XP</span>
              ${this.economy.usesServerCandy ? '' : `<span>+${activeGoal.completionRewards.candyBars} ${CANDY_EMOJI}</span>`}
              <span class="reward-title-pill">Title: "${activeGoal.completionRewards.title}"</span>
            </div>

            <div class="community-stats-bar">
              <span>🏆 Total Channel Raids Completed: <strong>${completedRaidsCount}</strong></span>
            </div>
          </div>
        `;
      }
    } else if (this.activeQuestTab === 'lore') {
      const discoveredBottleIds = this.economy.discoveredBottleIds();
      const discoveredRelicIds = this.economy.discoveredRelicIds();

      if (this.activeReadingBottleId) {
        const bottle = getLoreBottle(this.activeReadingBottleId);
        if (bottle) {
          contentMarkup = `
            <div class="lore-parchment-reader">
              <div class="parchment-header">
                <div class="parchment-seal">🍾</div>
                <div class="parchment-meta">
                  <h3 class="parchment-title">${bottle.title}</h3>
                  <span class="parchment-subtitle">Penned by <strong>${bottle.sender}</strong> &middot; ${bottle.date}</span>
                </div>
              </div>
              <div class="parchment-body">
                ${bottle.content.split('\n\n').map(p => `<p>${p}</p>`).join('')}
              </div>
              <div class="parchment-footer">
                <span class="parchment-reward-tag">Recovered reward: +${bottle.reward.coins}🪙, +${bottle.reward.xp} XP</span>
                <button class="btn-small btn-primary" data-action="close-bottle-reader">Back to Lore Journal</button>
              </div>
            </div>
          `;
        }
      } else {
        const relicsMarkup = CURIO_RELICS.map((relic) => {
          const discovered = discoveredRelicIds.includes(relic.id);
          const rarityClass = `relic-${relic.rarity}`;
          return `
            <div class="curio-relic-card ${discovered ? 'discovered' : 'locked'} ${rarityClass}">
              <div class="curio-relic-icon">${discovered ? relic.iconEmoji : '❓'}</div>
              <div class="curio-relic-info">
                <div class="curio-relic-title-row">
                  <strong class="curio-relic-name">${discovered ? relic.name : 'Unknown Ancient Curio'}</strong>
                  <span class="curio-relic-rarity">${relic.rarity.toUpperCase()}</span>
                </div>
                <div class="curio-relic-lore">${discovered ? relic.lore : 'Lost in the deep waters. Dredge the depths or discover story bottles to unearth.'}</div>
                <div class="curio-relic-perk">${discovered ? `⚡ Perk: ${relic.perkDescription}` : '🔒 Perk locked'}</div>
              </div>
            </div>
          `;
        }).join('');

        const bottlesMarkup = LORE_BOTTLES.map((b) => {
          const discovered = discoveredBottleIds.includes(b.id);
          return `
            <li class="row lore-bottle-row ${discovered ? 'discovered' : 'locked'}">
              <div class="row-body">
                <div class="lore-bottle-head">
                  <span class="lore-bottle-icon">${discovered ? '🍾' : '🔒'}</span>
                  <strong>${discovered ? b.title : 'Unopened Message in a Bottle'}</strong>
                  ${discovered ? `<span class="lore-bottle-date">${b.date}</span>` : ''}
                </div>
                <span class="row-meta">${discovered ? `From ${b.sender}: "${b.preview}"` : `Clue: ${b.discoveryClue}`}</span>
              </div>
              <div class="row-actions">
                ${discovered
                  ? `<button class="btn-small btn-secondary" data-action="read-bottle" data-id="${b.id}">Read Letter 📜</button>`
                  : '<span class="claimed-badge" style="background: var(--paper-dark); color: var(--ink-light);">In the Deep</span>'
                }
              </div>
            </li>
          `;
        }).join('');

        contentMarkup = `
          <div class="lore-journal-header">
            <div class="lore-journal-stats">
              <span>🍾 Messages Uncorked: <strong>${discoveredBottleIds.length} / ${LORE_BOTTLES.length}</strong></span>
              <span>🏺 Curios Recovered: <strong>${discoveredRelicIds.length} / ${CURIO_RELICS.length}</strong></span>
            </div>
            <p class="modal-note">Historical letters and mythical relics recovered from the deep waters of Fish and Chat.</p>
          </div>

          <h4 class="modal-subhead">Curio Cabinet (Mythical Relics)</h4>
          <div class="curio-cabinet-grid">
            ${relicsMarkup}
          </div>

          <h4 class="modal-subhead" style="margin-top: 16px;">Archive of Messages in a Bottle</h4>
          <ul class="modal-list">
            ${bottlesMarkup}
          </ul>
        `;
      }
    }

    this.modalHost.innerHTML = this.modalShell(
      'Story & Goals',
      `
        ${tabsMarkup}
        ${contentMarkup}
      `
    );
    this.bindModalActions();
  }

  private renderSkills(): void {
    const available = this.economy.skillPointsAvailable();
    const rows = ARCHETYPE_CATALOG.map((archetype) => {
      const points = this.economy.archetypePoints(archetype.id);
      return `
        <li class="row">
          <div class="row-body">
            <strong>${archetype.name}</strong> <span class="tier-badge">${points}</span>
            <span class="row-meta">${archetype.description}</span>
          </div>
          <div class="row-actions">
            <button class="btn-small ${available > 0 ? '' : 'btn-disabled'}" data-action="spend-skill-point" data-id="${archetype.id}" ${available > 0 ? '' : 'disabled'}>+1</button>
          </div>
        </li>`;
    }).join('');

    this.modalHost.innerHTML = this.modalShell(
      'Skills',
      `
        <div class="craft-header">
          <strong>Skill Points Available: ${available}</strong>
          <span class="modal-note">Earned one per fishing level-up. Spend them to fight tougher fish.</span>
        </div>
        <ul class="modal-list">${rows}</ul>
      `,
    );
    this.bindModalActions();
  }

  private getUiTourSteps(): Array<{ text: string; selectors: string[]; expandRail?: boolean }> {
    return [
      {
        text: 'Anchor (⚓) is the Channel Boss Raid! Every fish you & chat catch fills this gauge for a group reward. Tap ⚓ anytime to open Boss Raids.',
        selectors: ['#hud-community-pill'],
      },
      {
        text: 'Top Bar shows your Level & XP (unlocking Sunset Pier at Lv 10 & Moonlit Cove at Lv 20), plus Coins and Candy Bars.',
        selectors: ['#hud-level-block', '#hud-coins-pill', '#hud-candy-pill'],
      },
      {
        text: 'Tap ☰ Menu anytime to open or close all game areas — Shops, Closet, Quests, Crafting, Skills, and more!',
        selectors: ['#rail-toggle'],
      },
      {
        text: 'Economy & Gear: 📜 Story/Quests & Boss Raids, 🪱 Shop (bait & Fishbots), 🪙 Market (sell fish), 🔨 Craft upgrades, 🍫 Candy Shop.',
        selectors: ['#btn-quests', '#btn-shop', '#btn-market', '#btn-craft', '#btn-candy'],
        expandRail: true,
      },
      {
        text: 'Character & Progress: 👤 Closet (Boy/Girl & outfits), 📖 Scrap Book (catch log), ⭐ Skills, ⚙️ Settings, and ❓ Guide.',
        selectors: ['#btn-closet', '#btn-collection', '#btn-skills', '#btn-settings', '#btn-guide'],
        expandRail: true,
      },
      {
        text: 'Right Bait Bar lets you quick-switch lures anytime. Tap a bait to equip it!',
        selectors: ['#hud-bait-bar'],
      },
      {
        text: 'Bottom-left Fish Basket holds your catch. Tap it anytime to inspect fish or sell them at the Market! Reopen ❓ Guide anytime.',
        selectors: ['#basket-badge'],
      },
    ];
  }

  private startUiTour(): void {
    this.closeModal();
    this.uiTourStep = 0;
    this.uiTourOpenedRail = false;
    this.renderTutorialBubble(this.gameState.getPhase());
  }

  private advanceUiTour(): void {
    const steps = this.getUiTourSteps();
    if (this.uiTourStep < 0) return;
    if (this.uiTourStep + 1 >= steps.length) {
      this.endUiTour();
      return;
    }
    this.uiTourStep += 1;
    this.renderTutorialBubble(this.gameState.getPhase());
  }

  private endUiTour(): void {
    this.uiTourStep = -1;
    this.lastUiTourHighlightStep = -2;
    if (this.uiTourOpenedRail) {
      this.collapseRail();
      this.uiTourOpenedRail = false;
    }
    this.clearUiTourHighlights();
    this.renderTutorialBubble(this.gameState.getPhase());
  }

  private clearUiTourHighlights(): void {
    this.root.querySelectorAll('.tour-highlight-target').forEach((el) => {
      el.classList.remove('tutorial-flash-stroke', 'tour-highlight-target');
    });
  }

  private syncUiTourHighlights(): void {
    this.clearUiTourHighlights();
    this.lastUiTourHighlightStep = this.uiTourStep;
    if (this.uiTourStep < 0 || this.openModal) return;
    const step = this.getUiTourSteps()[this.uiTourStep];
    if (!step) return;
    if (step.expandRail && !this.railExpanded) {
      this.railExpanded = true;
      this.railItems.classList.remove('hidden');
      this.railToggle.setAttribute('aria-expanded', 'true');
      this.uiTourOpenedRail = true;
    } else if (!step.expandRail && this.uiTourOpenedRail) {
      this.collapseRail();
      this.uiTourOpenedRail = false;
    }
    for (const selector of step.selectors) {
      const target = this.root.querySelector(selector);
      if (target) {
        target.classList.add('tutorial-flash-stroke', 'tour-highlight-target');
      }
    }
  }

  private renderGuide(): void {
    const body = `
      <div class="guide-hero-card">
        <div class="guide-hero-row">
          <img class="barnaby-portrait" src="./images/barnaby-portrait.png" alt="Old Barnaby" />
          <div>
            <strong>Old Barnaby&rsquo;s Dock Guide</strong>
            <p class="row-meta" style="margin:2px 0 0;">Learn what every icon, gauge, and menu section does.</p>
          </div>
        </div>
        <div class="tour-actions-row">
          <button type="button" class="btn-small" id="btn-start-ui-tour" style="flex:1;">🧭 Start Interactive UI Tour</button>
        </div>
      </div>

      <h4 class="guide-section-title">Top HUD &amp; Anchor</h4>
      <div class="guide-list">
        <div class="guide-item">
          <span class="guide-item-icon">⚓</span>
          <div class="guide-item-copy"><strong>Anchor Pill (Channel Boss Raid):</strong> Tracks the shared Boss Raid progress! Every fish you and stream chat catch (plus Cheers) fills this gauge. Reach 100% to defeat the Boss for a group reward. Tap <strong>⚓</strong> anytime to open the <strong>Boss Raids</strong> tab.</div>
        </div>
        <div class="guide-item">
          <span class="guide-item-icon">⭐</span>
          <div class="guide-item-copy"><strong>Level &amp; XP Bar:</strong> Catching fish earns XP. Reaching <strong>Lv 10</strong> unlocks Sunset Pier and <strong>Lv 20</strong> unlocks Moonlit Cove!</div>
        </div>
        <div class="guide-item">
          <span class="guide-item-icon">🪙</span>
          <div class="guide-item-copy"><strong>Coins &amp; 🍫 Candy Bars:</strong> Sell fish at the Market for Coins, and use Candy Bars (tap 🍫) for cosmetics &amp; stream boosts.</div>
        </div>
      </div>

      <h4 class="guide-section-title">Opening the Menu (☰) &amp; Sections</h4>
      <div class="guide-list">
        <div class="guide-item">
          <span class="guide-item-icon">☰</span>
          <div class="guide-item-copy"><strong>Menu Button:</strong> Tap <strong>☰</strong> on the upper right to expand or collapse all 10 game sections below:</div>
        </div>
        <div class="guide-item"><span class="guide-item-icon">📜</span><div class="guide-item-copy"><strong>Story &amp; Quests:</strong> Barnaby&rsquo;s story chapters, daily quests, milestones, Channel Boss Raids, and lore bottles.</div></div>
        <div class="guide-item"><span class="guide-item-icon">🪱</span><div class="guide-item-copy"><strong>Shop:</strong> Buy stronger baits for rarer fish, hire automated Fishbots, and recycle pond trash.</div></div>
        <div class="guide-item"><span class="guide-item-icon">🪙</span><div class="guide-item-copy"><strong>Market:</strong> Sell caught fish from your basket for Coins and use the Sorter Tray.</div></div>
        <div class="guide-item"><span class="guide-item-icon">🔨</span><div class="guide-item-copy"><strong>Crafting Bench:</strong> Turn recycled trash into materials and craft Rod, Line, Reel, and Luck upgrades.</div></div>
        <div class="guide-item"><span class="guide-item-icon">🍫</span><div class="guide-item-copy"><strong>Candy Bar Shop:</strong> Unlock premium outfits, the Bottomless Tackle Box, and channel-wide cheers.</div></div>
        <div class="guide-item"><span class="guide-item-icon">👤</span><div class="guide-item-copy"><strong>Closet:</strong> Switch between Boy &amp; Girl Angler, pick skin tones, and equip hats &amp; outfits in 3D.</div></div>
        <div class="guide-item"><span class="guide-item-icon">📖</span><div class="guide-item-copy"><strong>Scrap Book:</strong> Big Fish Tails collection log showing every species caught and your heaviest records.</div></div>
        <div class="guide-item"><span class="guide-item-icon">⭐</span><div class="guide-item-copy"><strong>Skills:</strong> Spend Skill Points on perks (Brawler, Patience, Trapper, Charmer, Tactician) and Prestige.</div></div>
        <div class="guide-item"><span class="guide-item-icon">⚙️</span><div class="guide-item-copy"><strong>Settings:</strong> Adjust Master, SFX, and Ambience volume sliders or set a display name.</div></div>
      </div>

      <h4 class="guide-section-title">Dock Controls</h4>
      <div class="guide-list">
        <div class="guide-item"><span class="guide-item-icon">🎣</span><div class="guide-item-copy"><strong>Bait Bar (Right Edge):</strong> Tap any owned bait icon to equip it immediately before casting.</div></div>
        <div class="guide-item"><span class="guide-item-icon">🧺</span><div class="guide-item-copy"><strong>Fish Basket (Bottom-Left):</strong> Shows how full your basket is. Tap it anytime to open the Market and sell!</div></div>
      </div>
    `;
    this.modalHost.innerHTML = this.modalShell('How to Play & UI Guide', body);
    this.el('#btn-start-ui-tour').addEventListener('click', () => this.startUiTour());
    this.bindModalActions();
  }

  private renderDebug(): void {
    const perfectCastOn = this.gameState.debugPerfectCastMode;
    const autoFishOn = this.gameState.autoFishingEnabled;
    const state = this.economy.snapshot;

    this.modalHost.innerHTML = this.modalShell(
      'Debug',
      `
        <ul class="modal-list">
          <li class="row debug-wipe-row">
            <div class="row-body">
              <strong>Wipe User Data</strong>
              <span class="row-meta">Reset all progress, inventory, coins, and unlocks to start fresh.</span>
            </div>
            <div class="row-actions">
              <button class="btn-small ${this.debugResetArmed ? 'btn-danger' : 'btn-warn'}" data-action="debug-wipe-user-data">
                ${this.debugResetArmed ? '⚠️ Confirm Wipe!' : 'Wipe Data'}
              </button>
            </div>
          </li>
          <li class="row debug-slider-row">
            <div class="row-body">
              <div class="debug-slider-header">
                <strong>Player Level</strong>
                <span class="debug-level-badge" id="debug-level-val">Lv ${state.level}</span>
              </div>
              <span class="row-meta">Choose player level (1-9: Pond, 10-19: Ocean, 20+: Cosmic)</span>
              <div class="debug-slider-container">
                <input
                  type="range"
                  id="debug-level-slider"
                  class="debug-level-slider"
                  min="1"
                  max="30"
                  step="1"
                  value="${state.level}"
                  aria-label="Player Level"
                />
              </div>
              <div class="debug-slider-presets">
                <button class="btn-micro" type="button" data-level-jump="1">Lv 1 (Pond)</button>
                <button class="btn-micro" type="button" data-level-jump="10">Lv 10 (Ocean)</button>
                <button class="btn-micro" type="button" data-level-jump="20">Lv 20 (Cosmic)</button>
                <button class="btn-micro" type="button" data-level-jump="30">Lv 30</button>
              </div>
            </div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Perfect Cast</strong><span class="row-meta">Every cast locks at 100% precision.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-toggle-perfect-cast">${perfectCastOn ? 'On' : 'Off'}</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Auto-Fish (AFK)</strong><span class="row-meta">Casts and reels automatically.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-toggle-auto-fish">${autoFishOn ? 'On' : 'Off'}</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>+500 Coins</strong></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-add-coins">Grant</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>+5 Trash</strong></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-add-garbage">Grant</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Force Next Catch: Coin Purse</strong><span class="row-meta">Next successful reel is a Sunken Coin Purse.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-force-treasure">Set</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Lucky Coin Bottle</strong><span class="row-meta">${this.economy.hasLuckyCoinBottle() ? 'Unlocked: Coin flip active for paid bait.' : 'Locked: Must be found using Neon Lure.'}</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-toggle-coin-bottle">${this.economy.hasLuckyCoinBottle() ? 'Unlocked' : 'Locked'}</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Force Next Catch: Coin in Bottle</strong><span class="row-meta">Next successful reel is the Lucky Coin in a Bottle.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-force-coin-bottle">Set</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Weather System</strong><span class="row-meta">Force weather state & atmosphere.</span></div>
            <div class="row-actions" style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button class="btn-micro" data-action="debug-set-weather" data-id="clear">☀️ Clear</button>
              <button class="btn-micro" data-action="debug-set-weather" data-id="rain">🌧️ Rain</button>
              <button class="btn-micro" data-action="debug-set-weather" data-id="fog">🌫️ Fog</button>
              <button class="btn-micro" data-action="debug-set-weather" data-id="golden-hour">🌅 Golden</button>
              <button class="btn-micro" data-action="debug-set-weather" data-id="rainbow">🌈 Rainbow</button>
            </div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Whale Breach</strong><span class="row-meta">Trigger distant whale leap across horizon.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-trigger-whale">🐋 Breach</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Kraken Tentacle</strong><span class="row-meta">Trigger giant abyssal kraken tentacle surge.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-trigger-kraken">🦑 Kraken</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Finish Boss Raid</strong><span class="row-meta">Immediately complete channel boss raid.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-complete-raid">⚔️ Complete</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Raid Ticker Preview</strong><span class="row-meta">Shows a sample contribution without changing raid progress.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-preview-raid-ticker">Preview</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Uncork Lore Bottle</strong><span class="row-meta">Unlock next Message in a Bottle letter.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-discover-bottle">🍾 Uncork</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Recover Ancient Relic</strong><span class="row-meta">Add next mythical curio relic to cabinet.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-discover-relic">🏺 Recover</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Spawn 3D Water Bottle</strong><span class="row-meta">Drop floating bottle into shoreline water.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-spawn-bottle-prop">🌊 Spawn Prop</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Barnaby Dock Speech</strong><span class="row-meta">Preview Barnaby's compact dialogue card.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-barnaby-speak">💬 Speak</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>+500 XP</strong><span class="row-meta">Fast level progression.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-add-xp">+500 XP</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Prestige Rank</strong><span class="row-meta">Current rank: ${this.economy.prestige()}</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-prestige">Ascend</button></div>
          </li>
          <li class="row">
            <div class="row-body"><strong>Start Tutorial</strong><span class="row-meta">Resets tutorial progress to cast 1.</span></div>
            <div class="row-actions"><button class="btn-small" data-action="debug-start-tutorial">Start</button></div>
          </li>
          <li class="row">
            <div class="row-body">
              <strong>Interactive UI Tour</strong>
              <span class="row-meta">Step through Barnaby&rsquo;s guided tour of the Anchor, Menu, and HUD.</span>
            </div>
            <div class="row-actions">
              <button class="btn-small" data-action="debug-start-ui-tour">Start Tour</button>
            </div>
          </li>
        </ul>
      `,
    );

    const levelSlider = this.modalHost.querySelector<HTMLInputElement>('#debug-level-slider');
    const levelVal = this.modalHost.querySelector<HTMLElement>('#debug-level-val');

    const updateLevel = (targetLevel: number) => {
      const clamped = Math.max(1, Math.min(30, Math.floor(targetLevel)));
      const result = this.economy.setLevel(clamped);
      if (levelVal) levelVal.textContent = `Lv ${result.newLevel}`;
      if (levelSlider) levelSlider.value = String(result.newLevel);
      if (result.themeChanged) {
        this.events.emit('themeChanged', { theme: result.newTheme });
      }
      this.renderHud();
    };

    if (levelSlider) {
      levelSlider.addEventListener('input', () => updateLevel(Number(levelSlider.value)));
      levelSlider.addEventListener('change', () => updateLevel(Number(levelSlider.value)));
    }

    this.modalHost.querySelectorAll<HTMLButtonElement>('button[data-level-jump]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const jumpVal = Number(btn.getAttribute('data-level-jump'));
        if (Number.isFinite(jumpVal)) {
          updateLevel(jumpVal);
        }
      });
    });

    this.bindModalActions();
  }

  private renderShop(): void {
    const isFirstBaitTutorialShopVisit =
      !this.economy.hasCompletedBaitTutorial() && this.economy.getTutorialCastCount() >= 2;
    if (isFirstBaitTutorialShopVisit) {
      this.barnabyMessage = "Glurp, oh hi new one. Grab some slurplys";
      this.baitTutorialStep = 3;
      this.renderHud();
    }

    const state = this.economy.snapshot;
    const baitRows = BAIT_CATALOG.map((bait) => {
      const owned = state.baitInventory[bait.id] ?? 0;
      const isMarshmallowsHighlight = isFirstBaitTutorialShopVisit && bait.id === 'marshmallows';
      return `
        <li class="row ${isMarshmallowsHighlight ? 'tutorial-flash-stroke' : ''}" id="shop-bait-${bait.id}">
          ${rowIcon(bait.id, bait.name, icon(ICON.bait, bait.name))}
          <div class="row-body">
            <strong>${bait.name}</strong>
            <span class="row-meta">${bait.free ? 'always available' : `${bait.costPerTen}🪙 / 10`} &middot; have ${bait.free ? '&infin;' : owned}</span>
          </div>
          <div class="row-actions">
            ${bait.free ? '' : `<button class="btn-small ${isMarshmallowsHighlight ? 'tutorial-flash-stroke' : ''}" data-action="buy-bait" data-id="${bait.id}">Buy 10</button>`}
          </div>
        </li>`;
    }).join('');

    const botRows = FISHBOT_CATALOG.map((bot) => {
      const botState = state.fishbots[bot.id];
      const owned = botState?.owned;
      const secondsToNext = owned ? Math.max(0, Math.ceil((botState.nextReadyAtMs - Date.now()) / 1000)) : 0;
      const statusLine = owned
        ? secondsToNext > 0
          ? `<span class="row-meta">🟢 Active — next catch in ${secondsToNext}s</span>`
          : `<span class="row-meta">🟢 Active — catch ready, check the hopper below</span>`
        : '';
      const hopperCount = state.fishbotHopper.filter((item) => item.sourceBotId === bot.id).length;
      const moduleLine = owned ? `<span class="row-meta">Hopper ${hopperCount}/${this.economy.hopperCapacity(bot.id)} · ${botState.mode ?? 'balanced'} · ${botState.autoUnload ? 'auto unload on' : 'manual unload'}</span>
        <span class="row-meta">Hopper +5: ${250 * ((botState.hopperTier ?? 0) + 1)}🪙 + ${((botState.hopperTier ?? 0) + 1)} metal (max 3) · Auto unload: 600🪙 + 3 metal · Modes: 400🪙 + 2 metal</span>
        <div class="row-actions"><button class="btn-small" data-action="buy-bot-module" data-id="${bot.id}" data-module="hopper" ${(botState.hopperTier ?? 0) >= 3 ? 'disabled' : ''}>Hopper +5</button>
        <button class="btn-small" data-action="buy-bot-module" data-id="${bot.id}" data-module="unload" ${botState.autoUnload ? 'disabled' : ''}>Auto unload</button>
        <button class="btn-small" data-action="${botState.unlockedModes?.includes('salvage') ? 'set-bot-mode' : 'buy-bot-module'}" data-id="${bot.id}" data-module="salvage" data-mode="salvage">${botState.unlockedModes?.includes('salvage') ? 'Use salvage' : 'Unlock salvage'}</button>
        <button class="btn-small" data-action="${botState.unlockedModes?.includes('trophy') ? 'set-bot-mode' : 'buy-bot-module'}" data-id="${bot.id}" data-module="trophy" data-mode="trophy">${botState.unlockedModes?.includes('trophy') ? 'Use trophy' : 'Unlock trophy'}</button>
        <button class="btn-small" data-action="set-bot-mode" data-id="${bot.id}" data-mode="balanced">Balanced</button></div>` : '';
      return `
        <li class="row">
          ${rowIcon(bot.id, bot.name)}
          <div class="row-body">
            <strong>${bot.name}</strong>
            <span class="row-meta">${bot.cost}🪙 &middot; ${bot.baseIntervalSeconds}s cycle</span>
            ${statusLine}
            ${moduleLine}
          </div>
          <div class="row-actions">
            <button class="btn-small" data-action="buy-fishbot" data-id="${bot.id}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : 'Buy'}</button>
          </div>
        </li>`;
    }).join('');

    const hopperCount = state.fishbotHopper.length;
    const trashCount = this.economy.trashBucket().length;

    const safeBarnabyMsg = this.barnabyMessage ? escapeWalletText(this.barnabyMessage) : '';
    const barnabyHeader = `
      <div class="barnaby-header-slot">
        <button class="barnaby-portrait-btn" data-action="click-barnaby" type="button" aria-label="Barnaby">
          <img class="barnaby-portrait-small" src="./images/barnaby-portrait.png" alt="Barnaby" />
        </button>
        ${this.barnabyMessage ? `<button class="barnaby-bubble" type="button" data-action="close-barnaby-message">${this.barnabyMessage.toLowerCase().includes('gulp') || this.barnabyMessage.toLowerCase().includes('glurp') ? safeBarnabyMsg : `${safeBarnabyMsg} <em>*gulp*</em>`}</button>` : ''}
      </div>
    `;

    this.modalHost.innerHTML = this.modalShell(
      'Shop',
      `
        <div class="shop-wallet-banner" id="shop-wallet-banner">
          <span class="shop-wallet-label">Your Money:</span>
          <span class="shop-wallet-amount"><strong id="shop-coins-amount">${state.coins}</strong> ${icon(ICON.coin, 'coins', 'inline-icon')}</span>
        </div>
        <div class="craft-actions-row">
          <span class="craft-trash-count">Trash bucket: ${trashCount} (unlimited)</span>
          <button class="btn-small" data-action="recycle-all" ${trashCount === 0 ? 'disabled' : ''}>Recycle All</button>
        </div>
        <h4 class="modal-subhead">Bait</h4>
        <ul class="modal-list">${baitRows}</ul>
        <h4 class="modal-subhead">Fishbots</h4>
        <ul class="modal-list">${botRows}</ul>
        <p class="modal-note">Hopper: ${hopperCount} queued across owned bots <button class="btn-small" data-action="claim-hopper" ${hopperCount === 0 ? 'disabled' : ''}>Claim</button></p>
      `,
      barnabyHeader,
    );
    this.bindModalActions();

    if (this.requestedBaitFocus) {
      const targetBaitId = this.requestedBaitFocus;
      this.requestedBaitFocus = null;
      setTimeout(() => {
        const row = this.modalHost.querySelector<HTMLElement>(`#shop-bait-${targetBaitId}`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          row.classList.add('highlight-pulse');
        }
      }, 50);
    }
  }

  private renderMarket(): void {
    const state = this.economy.snapshot;
    const sellableCount = state.basket.filter((item) => !item.isTrash).length;
    const isBasketTutorial = (this.inBasketTutorial || this.economy.basketFull()) && sellableCount > 0;

    const rows = state.basket.map((item, index) => {
      if (item.isTrash) return '';
      const species = FISH_CATALOG.find((f) => f.id === item.catchId);
      const value = species ? this.economy.getFishValue(item.catchId, item.weightKg, item.golden) : 0;
      const highlightRowSell = isBasketTutorial && sellableCount === 1;
      return `
        <li class="row">
          ${rowIcon(item.catchId, catchName(item.catchId))}
          <div class="row-body">
            <strong>${item.golden ? 'Golden ' : ''}${catchName(item.catchId)} ${item.protectedCatch ? '★' : ''}</strong>
            <span class="row-meta">${item.weightKg.toFixed(2)}kg &middot; ${value} ${icon(ICON.coin, 'coins', 'inline-icon')}</span>
          </div>
          <div class="row-actions market-row-actions">
            <button class="btn-small ${highlightRowSell ? 'tutorial-glow' : ''}" data-action="sell" data-method="sell" data-index="${index}">Sell</button>
          </div>
        </li>`;
    }).join('');

    const bulkBtnClass = `btn-small${sellableCount === 0 ? ' btn-disabled' : ''}`;
    const bulkBtnDisabled = sellableCount === 0 ? 'disabled' : '';

    this.modalHost.innerHTML = this.modalShell(
      "Monger Barnaby's Market",
      `
        <div class="market-header">
          <img class="barnaby-portrait" src="./images/barnaby-portrait.png" alt="Monger Barnaby" />
          <div class="market-header-details">
            <div class="market-speech-bubble ${isBasketTutorial ? 'market-tutorial-active' : ''}">
              ${isBasketTutorial
                ? `<span class="tutorial-tag">TUTORIAL</span><span>Sell your fish to earn coins and empty your basket! Tap <strong>Sell All</strong> below.</span>`
                : sellableCount === 0
                ? `<span>Basket is empty! Go catch some more fish, partner.</span>`
                : `<span>Fresh fish! Sell &apos;em for shiny coins.</span>`
              }
            </div>
          </div>
        </div>
        <div class="market-bulk-row">
          <button class="${bulkBtnClass} ${isBasketTutorial ? 'tutorial-glow' : ''}" data-action="sell-all" data-method="sell" ${bulkBtnDisabled}>Sell All</button>
        </div>
        <h4 class="modal-subhead">Sorter Tray &amp; Auto Seller</h4>
        ${state.sorterTrayOwned ? `<p class="modal-note">Auto sold ${state.autoSaleCount ?? 0} fish for ${state.autoSaleCoins ?? 0}🪙. New species, personal records, Golden fish, and rare or better catches are kept. Automation runs only while the game is open.</p>
          <div class="row-actions">${['common', 'uncommon'].map((rarity) => `<button class="btn-small" data-action="toggle-auto-sell" data-id="${rarity}">Auto sell ${rarity}: ${(state.autoSellRarities ?? []).includes(rarity) ? 'On' : 'Off'}</button>`).join('')}</div>`
          : `<p class="modal-note">Unlock for 900🪙 + 4 metal. You have ${state.coins}🪙 and ${state.materials.metal ?? 0} metal.${(state.materials.metal ?? 0) < 4 ? ' Recycle Tin Cans at the Crafting Bench to get metal.' : ''} Common and uncommon auto sell start on; you can switch either off afterward. New species, personal records, Golden fish, and rare or better catches are kept.</p><button class="btn-small" data-action="buy-sorter-tray">Unlock Sorter Tray</button>`}
        <ul class="modal-list">${rows || '<li class="row modal-empty">Basket is empty. Go catch something!</li>'}</ul>
      `,
    );
    this.bindModalActions();
  }

  private renderCraft(): void {
    const state = this.economy.snapshot;
    const canAffordMaterials = (cost: Partial<Record<string, number>>): boolean => {
      return Object.entries(cost).every(([mat, needed]) => {
        if (!needed) return true;
        return (state.materials[(mat as any) as keyof typeof state.materials] ?? 0) >= needed;
      });
    };

    const formatMaterialCost = (cost: Partial<Record<string, number>>): string => {
      return Object.entries(cost)
        .filter(([, needed]) => !!needed)
        .map(([mat, needed]) => {
          const have = state.materials[(mat as any) as keyof typeof state.materials] ?? 0;
          const short = have < (needed as number);
          return `<span class="${short ? 'cost-missing' : ''}">${needed} ${mat}${short ? ` (have ${have})` : ''}</span>`;
        })
        .join(', ');
    };

    const formatCoinCost = (coinsNeeded: number): string => {
      const short = state.coins < coinsNeeded;
      return `<span class="${short ? 'cost-missing' : ''}">${coinsNeeded}🪙${short ? ` (have ${state.coins})` : ''}</span>`;
    };

    // Materials section at top
    const materialEntries = Object.entries(state.materials).filter(([, amount]) => amount > 0);
    const materialsLine = materialEntries.length
      ? materialEntries.map(([id, amount]) => {
          const sprite = spriteFor(id);
          return `<span class="material-chip">${sprite ? icon(sprite, id, 'inline-icon') : ''}${amount} ${id}</span>`;
        }).join('')
      : '<span class="modal-note">No materials yet — recycle trash below.</span>';

    const trashCount = this.economy.trashBucket().length;

    // Upgrade rows with material availability checks
    const upgradeRows = UPGRADE_CATALOG.map((upgrade) => {
      const tier = state.upgrades[upgrade.id] ?? 0;
      const maxed = tier >= upgrade.maxTier;
      const cost = upgrade.costPerTier[Math.min(tier, upgrade.maxTier - 1)];
      const hasCoins = state.coins >= cost.coins;
      const hasMaterials = canAffordMaterials(cost.materials);
      const canCraft = !maxed && hasCoins && hasMaterials;
      const costLabel = formatMaterialCost(cost.materials);
      return `
        <li class="row">
          ${rowIcon(upgrade.id, upgrade.name, icon(ICON.hammer, upgrade.name))}
          <div class="row-body">
            <strong>${upgrade.name}</strong> <span class="tier-badge">${tier}/${upgrade.maxTier}</span>
            <span class="row-meta">${upgrade.description}</span>
            <span class="row-meta">${maxed ? 'Maxed' : `${formatCoinCost(cost.coins)}${costLabel ? `, ${costLabel}` : ''}`}</span>
          </div>
          <div class="row-actions">
            <button class="btn-small ${!canCraft && !maxed ? 'btn-disabled' : ''}" data-action="buy-upgrade" data-id="${upgrade.id}" ${!canCraft && !maxed ? 'disabled' : maxed ? 'disabled' : ''}>${maxed ? 'Maxed' : 'Craft'}</button>
          </div>
        </li>`;
    }).join('');

    // Lucky Ducky
    const duckyCanCraft = (state.materials.rubber ?? 0) >= 2 && (state.materials.fabric ?? 0) >= 1;

    const duckyActive = this.economy.isLuckyDuckyActive();
    const duckySec = this.economy.luckyDuckyTimeRemainingSec();
    let duckyTimerMarkup = '';
    if (duckyActive) {
      const mins = Math.floor(duckySec / 60);
      const secs = String(duckySec % 60).padStart(2, '0');
      duckyTimerMarkup = `<div class="ducky-timer-banner">🦆 Lucky Ducky Buff: ${mins}:${secs} remaining (85% salvage rate)</div>`;
    } else {
      duckyTimerMarkup = `<div class="ducky-timer-banner inactive">Base Salvage Rate: 60%</div>`;
    }

    this.modalHost.innerHTML = this.modalShell(
      'Crafting Bench',
      `
        <div class="craft-header">
          <div class="craft-materials-section">
            <strong>Materials stash:</strong>
            <div class="materials-chips-list">${materialsLine}</div>
          </div>
          <div class="craft-actions-row">
            <span class="craft-trash-count">Trash bucket: ${trashCount} (unlimited)</span>
            <button class="btn-small" data-action="recycle-all" ${trashCount === 0 ? 'disabled' : ''}>Recycle All</button>
          </div>
        </div>

        ${duckyTimerMarkup}

        <h4 class="modal-subhead">Upgrades</h4>
        <ul class="modal-list">${upgradeRows}</ul>

        <h4 class="modal-subhead">Consumables</h4>
        <ul class="modal-list">
          <li class="row">
            ${rowIcon('lucky-ducky', 'Lucky Rubber Ducky', '🦆')}
            <div class="row-body">
              <strong>Lucky Rubber Ducky</strong>
              <span class="row-meta">Boosts salvage rate to 85% for 5 minutes &middot; have ${state.luckyDuckyCount ?? 0}</span>
              <span class="row-meta">Cost: ${formatMaterialCost({ rubber: 2, fabric: 1 })}</span>
            </div>
            <div class="row-actions">
              <button class="btn-small ${!duckyCanCraft ? 'btn-disabled' : ''}" data-action="craft-ducky" ${!duckyCanCraft ? 'disabled' : ''}>Craft</button>
              <button class="btn-small" data-action="use-ducky" ${(state.luckyDuckyCount ?? 0) === 0 ? 'disabled' : ''}>Use</button>
            </div>
          </li>
        </ul>
      `,
    );
    this.bindModalActions();
  }

  private renderCandyShop(): void {
    const state = this.economy.snapshot;
    const wallets = Object.entries(this.economy.candyWallets())
      .sort(([a], [b]) => a === state.activeChannelId ? -1 : b === state.activeChannelId ? 1 : a.localeCompare(b));
    const walletRows = wallets.map(([channelId, wallet]) => {
      const avatar = walletAvatar(wallet.avatarUrl);
      const recent = (wallet.activity ?? []).slice(0, 3).map((entry) =>
        `<span class="row-meta">${escapeWalletText(new Date(entry.at).toLocaleDateString())}: ${entry.delta > 0 ? '+' : ''}${entry.delta} ${CANDY_EMOJI}${entry.reason ? ` · ${escapeWalletText(entry.reason.startsWith('bits:') ? 'Bits exchange' : entry.reason.startsWith('premium:') ? 'Fashion / gear' : entry.reason)}` : ''}</span>`
      ).join('');
      return `<li class="row candy-wallet-row ${channelId === state.activeChannelId ? 'candy-wallet-current' : ''}">
        <div class="candy-wallet-wrapper">${avatar ? `<img src="${avatar}" alt="" loading="lazy" />` : CANDY_EMOJI}</div>
        <div class="row-body"><strong>${escapeWalletText(wallet.name)}</strong>
          <span class="row-meta">${channelId === state.activeChannelId ? 'Current channel · spend here' : 'Available when fishing on this channel'}</span>${recent}</div>
        <strong class="candy-wallet-balance">${wallet.balance} ${CANDY_EMOJI}</strong>
      </li>`;
    }).join('');

    const packRows = CANDY_BAR_PACKS.map((pack) => `
      <li class="row">
        <div class="row-body">
          <strong>${pack.name}</strong>
          <span class="row-meta">${pack.bitsCost} Bits &rarr; ${pack.candyBars} ${CANDY_EMOJI}</span>
        </div>
        <div class="row-actions">
          <button class="btn-small" data-action="buy-candy-pack" data-id="${pack.id}" ${this.muxySystem.isTwitchSession && !this.muxySystem.isPackAvailable(pack.id) ? 'disabled' : ''}>${this.muxySystem.isPackAvailable(pack.id) ? `Exchange ${pack.bitsCost} Bits` : this.muxySystem.isTwitchSession ? 'Bits unavailable' : 'Grant (Debug)'}</button>
        </div>
      </li>`).join('');

    const streamEvents = PREMIUM_CATALOG.filter((item) =>
      item.id === 'rainbow-totem' || item.id === 'mega-chum-bucket' || item.id === 'whale-call-horn'
    );

    const streamEventRows = streamEvents.map((item) => {
      const canAfford = !this.muxySystem.isTwitchSession && state.candyBars >= item.costCandyBars;
      let statusBadge = '';
      const btnLabel = this.muxySystem.isTwitchSession ? 'Unavailable on Twitch' : `Activate (${item.costCandyBars} ${CANDY_EMOJI})`;
      if (item.id === 'rainbow-totem') {
        const active = this.economy.isStreamBuffActive('rainbow-totem');
        if (active) {
          const rem = this.economy.streamBuffRemainingSeconds('rainbow-totem');
          statusBadge = `<span class="stream-event-badge active">🌈 Rainbow Active (${rem}s)</span>`;
        }
      } else if (item.id === 'mega-chum-bucket') {
        const active = this.economy.isStreamBuffActive('mega-chum-bucket');
        if (active) {
          const rem = this.economy.streamBuffRemainingSeconds('mega-chum-bucket');
          statusBadge = `<span class="stream-event-badge active">🐟 Chum Active (${rem}s)</span>`;
        }
      }

      return `
        <li class="row stream-event-row">
          <div class="row-body">
            <div class="stream-event-head">
              <strong>${item.name}</strong>
              ${statusBadge}
            </div>
            <span class="row-meta">${item.description}</span>
            <span class="row-meta cost-highlight">${item.costCandyBars} ${CANDY_EMOJI} &middot; <span class="stream-hero-tag">Current fisher effect</span></span>
          </div>
          <div class="row-actions">
            <button class="btn-small btn-primary ${!canAfford ? 'btn-disabled' : ''}" data-action="buy-premium" data-id="${item.id}" ${!canAfford ? 'disabled' : ''}>${btnLabel}</button>
          </div>
        </li>`;
    }).join('');

    const utilityItems = PREMIUM_CATALOG.filter((item) =>
      item.id === 'bottomless-tackle-box' || item.id === 'master-salvage-magnet'
    );

    const utilityRows = utilityItems.map((item) => {
      const owned = this.economy.ownsPremiumItem(item.id);
      const canAfford = state.candyBars >= item.costCandyBars;
      return `
        <li class="row">
          <div class="row-body">
            <strong>${item.name}</strong>
            <span class="row-meta">${item.description}</span>
            <span class="row-meta">${item.costCandyBars} ${CANDY_EMOJI}</span>
          </div>
          <div class="row-actions">
            <button class="btn-small ${!canAfford && !owned ? 'btn-disabled' : ''}" data-action="buy-premium" data-id="${item.id}" ${owned || !canAfford ? 'disabled' : ''}>${owned ? 'Owned' : 'Buy'}</button>
          </div>
        </li>`;
    }).join('');

    const cosmeticItems = PREMIUM_CATALOG.filter((item) =>
      !streamEvents.some((s) => s.id === item.id) && !utilityItems.some((u) => u.id === item.id)
    ).sort((a, b) => {
      const rank = (id: string): number => id === 'royal-cloak' ? 0
        : ['golden-rod-skin', 'starlight-fishbot-skin', 'sparkle-trail'].includes(id) ? 1 : 2;
      return rank(a.id) - rank(b.id);
    });

    const cosmeticRows = cosmeticItems.map((item) => {
      const owned = this.economy.ownsPremiumItem(item.id);
      const canAfford = state.candyBars >= item.costCandyBars;
      const cosmeticSlot: CosmeticSlot | null = item.id === 'golden-rod-skin' ? 'rod' : item.id === 'starlight-fishbot-skin' ? 'fishbot' : item.id === 'sparkle-trail' ? 'trail' : null;
      const equipped = cosmeticSlot ? this.economy.cosmeticEquipped(cosmeticSlot) === item.id : false;
      const featured = item.id === 'royal-cloak';
      const fallback = item.id.includes('rod') ? '🎣' : item.id.includes('trail') ? '✨' : item.id.includes('fishbot') ? '🤖' : '👑';
      return `
        <li class="fashion-card ${featured ? 'fashion-featured' : ''}">
          <div class="fashion-card-art">${fashionThumbnail(item.id, item.name, fallback)}</div>
          <div class="fashion-card-copy">
            <span class="fashion-card-kicker">${featured ? '✦ Boutique spotlight' : cosmeticSlot ? 'Hero cosmetic' : 'Exclusive fashion'}</span>
            <strong>${escapeWalletText(item.name)}</strong>
            <span class="row-meta">${escapeWalletText(item.description)}</span>
          </div>
          <div class="fashion-card-footer">
            <span class="fashion-price">${item.costCandyBars} ${CANDY_EMOJI}</span>
            ${owned && cosmeticSlot
              ? `<button class="btn-small" data-action="equip-cosmetic" data-slot="${cosmeticSlot}" data-id="${equipped ? '' : item.id}">${equipped ? 'Remove' : 'Equip'}</button>`
              : `<button class="btn-small ${!canAfford && !owned ? 'btn-disabled' : ''}" data-action="buy-premium" data-id="${item.id}" ${owned || !canAfford ? 'disabled' : ''}>${owned ? 'Owned' : 'Unlock'}</button>`}
          </div>
        </li>`;
    }).join('');

    const boxCanAfford = !this.muxySystem.isTwitchSession && state.candyBars >= BOX_OF_NOT_FISH_COST_CANDY_BARS;
    const boxContentsLabel = BOX_OF_NOT_FISH_CONTENTS.map((entry) => `${entry.quantity}&times; ${catchName(entry.trashId)}`).join(', ');

    const bundleRows = MATERIAL_BUNDLE_CATALOG.map((bundle) => {
      const canAfford = !this.muxySystem.isTwitchSession && state.candyBars >= bundle.costCandyBars;
      return `
        <li class="row">
          ${rowIcon(bundle.materialId, bundle.materialId)}
          <div class="row-body">
            <strong>${bundle.quantity}&times; ${bundle.materialId}</strong>
            <span class="row-meta">${bundle.costCandyBars} ${CANDY_EMOJI}</span>
          </div>
          <div class="row-actions">
            <button class="btn-small ${!canAfford ? 'btn-disabled' : ''}" data-action="buy-material-bundle" data-id="${bundle.id}" ${!canAfford ? 'disabled' : ''}>${this.muxySystem.isTwitchSession ? 'Unavailable on Twitch' : 'Get'}</button>
          </div>
        </li>`;
    }).join('');

    this.modalHost.innerHTML = this.modalShell(
      'Candy Bar Shop',
      `
        ${this.returnToClosetFromCandy ? '<button class="closet-return-link" data-action="return-to-closet" type="button">← Back to Closet</button>' : ''}
        <h4 class="modal-subhead">Channel Candy Wallets</h4>
        <p class="modal-note">Candy Bars belong to the channel where you receive them. Your fisher, gear, and clothing travel with you.</p>
        ${this.economy.usesServerCandy ? '<p class="modal-note">On Twitch, this wallet reflects verified Bits exchanges. Quest rewards give their listed coins and XP; local debug grants stay in standalone play.</p>' : ''}
        <ul class="modal-list candy-wallet-list">${walletRows || '<li class="row">No channel wallets yet.</li>'}</ul>

        <h4 class="modal-subhead">Get Candy Bars</h4>
        <ul class="modal-list">${packRows}</ul>

        <h4 class="modal-subhead">Pond Events</h4>
        ${this.muxySystem.isTwitchSession ? '<p class="modal-note">Pond event Candy redemption is being connected to the channel ledger.</p>' : ''}
        <ul class="modal-list">${streamEventRows}</ul>

        <h4 class="modal-subhead">Permanent Quality of Life</h4>
        <ul class="modal-list">${utilityRows}</ul>

        <h4 class="modal-subhead">Exclusive Fashion & Rods</h4>
        <p class="modal-note">Find a look for your next cast. Clothing appears in your Closet after purchase.</p>
        <ul class="fashion-grid">${cosmeticRows}</ul>

        <h4 class="modal-subhead">Box of Not Fish</h4>
        <ul class="modal-list">
          <li class="row">
            <div class="row-body">
              <strong>Box of Not Fish</strong>
              <span class="row-meta">Choose exactly 20 items. Suggested mix: ${boxContentsLabel}. Delivered to the uncapped trash bucket.</span>
              <div class="row-actions">${BOX_OF_NOT_FISH_CONTENTS.map((entry) => `<label>${catchName(entry.trashId)} <input class="box-quantity" data-trash-id="${entry.trashId}" type="number" min="0" max="20" step="1" value="${entry.quantity}" style="width:3.5em" /></label>`).join('')}</div>
              <span class="row-meta">${BOX_OF_NOT_FISH_COST_CANDY_BARS} ${CANDY_EMOJI}</span>
            </div>
            <div class="row-actions">
              <button class="btn-small ${!boxCanAfford ? 'btn-disabled' : ''}" data-action="buy-box-of-not-fish" ${!boxCanAfford ? 'disabled' : ''}>${this.muxySystem.isTwitchSession ? 'Unavailable on Twitch' : 'Get 20'}</button>
            </div>
          </li>
        </ul>

        <h4 class="modal-subhead">Material Bundles</h4>
        <ul class="modal-list">${bundleRows}</ul>
      `,
    );
    this.bindModalActions();
  }

  private wearNewClosetItem(id: string): void {
    if (this.openModal !== 'closet') return;
    const item = CLOTHING_CATALOG.find((entry) => entry.id === id);
    if (!item || !this.economy.ownsClothing(id)) return;
    this.previewClothingId = null;
    this.events.emit('clothingPreviewChanged', { id: null });
    this.craftingSystem.equipClothing(item.slot, id);
    this.showToast(`${item.name} is now in your outfit.`);
  }

  private scrollClosetToCollection(): void {
    const body = this.modalHost.querySelector<HTMLElement>('.modal-body');
    const collection = this.modalHost.querySelector<HTMLElement>('#closet-collection');
    const nav = this.modalHost.querySelector<HTMLElement>('.closet-shop-nav');
    if (body && collection && nav) {
      body.scrollTop += collection.getBoundingClientRect().top - body.getBoundingClientRect().top - nav.offsetHeight - 10;
    }
  }

  private renderCloset(): void {
    const previousBody = this.modalHost.querySelector<HTMLElement>('#closet-preview')?.closest<HTMLElement>('.modal-body');
    const previousScrollTop = previousBody?.scrollTop ?? 0;
    const state = this.economy.snapshot;
    const previewItem = CLOTHING_CATALOG.find((item) => item.id === this.previewClothingId) ?? null;
    const channelWallet = this.economy.candyWallets()[state.activeChannelId ?? 'local'];
    const walletName = escapeWalletText(channelWallet?.name ?? 'this channel');
    const ownedCount = CLOTHING_CATALOG.filter((item) => this.economy.ownsClothing(item.id)).length;

    const actionFor = (item: ClothingDefinition): string => {
      const equipped = state.equippedClothing[item.slot] === item.id;
      if (this.economy.ownsClothing(item.id)) {
        return `<button class="btn-small" data-action="${equipped ? 'unequip-clothing' : 'equip-clothing'}" data-slot="${item.slot}" data-id="${item.id}" type="button">${equipped ? 'Remove' : 'Wear now'}</button>`;
      }
      if (item.unlock.type === 'premium') {
        const premiumId = item.unlock.premiumId;
        const price = PREMIUM_CATALOG.find((entry) => entry.id === premiumId)?.costCandyBars ?? 0;
        return state.candyBars >= price
          ? `<button class="btn-small btn-craft" data-action="buy-clothing" data-id="${item.id}" type="button">Buy · ${price} ${CANDY_EMOJI}</button>`
          : `<button class="btn-small" data-action="open-candy-shop-from-closet" data-id="${item.id}" type="button">Get ${price - state.candyBars} more ${CANDY_EMOJI}</button>`;
      }
      const canCraft = state.coins >= item.unlock.coins && Object.entries(item.unlock.materials ?? {})
        .every(([material, needed]) => (state.materials[material as keyof typeof state.materials] ?? 0) >= (needed ?? 0));
      const claim = item.unlock.coins === 0 && !Object.keys(item.unlock.materials ?? {}).length;
      return `<button class="btn-small ${canCraft ? 'btn-craft' : 'btn-disabled'}" data-action="buy-clothing" data-id="${item.id}" type="button" ${canCraft ? '' : 'disabled'}>${claim ? 'Claim free' : `Craft · ${item.unlock.coins}🪙`}</button>`;
    };

    let previewCostText = '';
    if (previewItem) {
      if (this.economy.ownsClothing(previewItem.id)) previewCostText = 'In your wardrobe';
      else if (previewItem.unlock.type === 'premium') {
        const premiumId = previewItem.unlock.premiumId;
        previewCostText = `${PREMIUM_CATALOG.find((entry) => entry.id === premiumId)?.costCandyBars ?? 0} ${CANDY_EMOJI} · permanent unlock`;
      } else previewCostText = `${previewItem.unlock.coins}🪙${Object.keys(previewItem.unlock.materials ?? {}).length ? ' + materials' : ''} · craft to keep`;
    }

    const walletBanner = `<div class="closet-wallet-strip"><span><strong>${state.candyBars} ${CANDY_EMOJI}</strong> in ${walletName}<small>Candy looks travel with your fisher; bars stay in this channel.</small></span><button class="btn-small" data-action="open-candy-shop-from-closet" type="button">Get bars</button></div>`;

    const toneRow = BASE_TONE_CATALOG.map((tone) => {
      const active = state.baseToneId === tone.id;
      return `<button class="tone-swatch ${active ? 'tone-swatch-active' : ''}" data-action="set-base-tone" data-id="${tone.id}" style="background:${tone.color}" title="${tone.name}" aria-label="${tone.name}"></button>`;
    }).join('');

    // Equipped names for ensemble banner
    const getEquippedName = (slot: ClothingSlot): string => {
      const id = state.equippedClothing[slot];
      if (!id) return 'None';
      const item = CLOTHING_CATALOG.find((c) => c.id === id);
      return item ? item.name : 'None';
    };

    const hatName = getEquippedName('hat');
    const jacketName = getEquippedName('jacket');
    const pantsName = getEquippedName('pants');
    const shoesName = getEquippedName('shoes');

    // Equipped Ensemble Banner
    const ensembleBanner = `
      <div class="equipped-ensemble-banner">
        <div class="ensemble-header-row">
          <div class="ensemble-title">
            <span class="ensemble-title-icon">🪞</span>
            <span class="ensemble-title-text">Equipped Ensemble</span>
          </div>
          <button class="btn-style-shuffle" data-action="style-shuffle" type="button" title="Randomize your wardrobe from owned clothing">
            <span class="shuffle-dice">🎲</span> Style Shuffle
          </button>
        </div>
        <div class="ensemble-slots-row">
          <div class="ensemble-slot-pill ${state.equippedClothing.hat ? 'slot-filled' : 'slot-empty'}">
            <span class="ensemble-slot-icon">🧢</span>
            <div class="ensemble-slot-meta">
              <span class="ensemble-slot-label">Hat</span>
              <span class="ensemble-slot-value" title="${hatName}">${hatName}</span>
            </div>
          </div>
          <div class="ensemble-slot-pill ${state.equippedClothing.jacket ? 'slot-filled' : 'slot-empty'}">
            <span class="ensemble-slot-icon">🧥</span>
            <div class="ensemble-slot-meta">
              <span class="ensemble-slot-label">Jacket</span>
              <span class="ensemble-slot-value" title="${jacketName}">${jacketName}</span>
            </div>
          </div>
          <div class="ensemble-slot-pill ${state.equippedClothing.pants ? 'slot-filled' : 'slot-empty'}">
            <span class="ensemble-slot-icon">👖</span>
            <div class="ensemble-slot-meta">
              <span class="ensemble-slot-label">Pants</span>
              <span class="ensemble-slot-value" title="${pantsName}">${pantsName}</span>
            </div>
          </div>
          <div class="ensemble-slot-pill ${state.equippedClothing.shoes ? 'slot-filled' : 'slot-empty'}">
            <span class="ensemble-slot-icon">👟</span>
            <div class="ensemble-slot-meta">
              <span class="ensemble-slot-label">Shoes</span>
              <span class="ensemble-slot-value" title="${shoesName}">${shoesName}</span>
            </div>
          </div>
        </div>
        <div class="outfit-preset-controls">
          <span>Saved outfits</span>
          ${this.economy.outfitPresets().map((preset, index) => `<div class="outfit-preset-slot"><strong>${escapeWalletText(preset?.name ?? `Outfit ${index + 1}`)}</strong><button class="btn-small" data-action="save-outfit-preset" data-index="${index}" type="button">Save</button><button class="btn-small" data-action="wear-outfit-preset" data-index="${index}" type="button" ${preset ? '' : 'disabled'}>Wear</button></div>`).join('')}
        </div>
      </div>
    `;

    const shopCategories: { slot: ClothingSlot; icon: string; label: string }[] = [
      { slot: 'hat', icon: '🧢', label: 'Hats' },
      { slot: 'jacket', icon: '🧥', label: 'Tops' },
      { slot: 'pants', icon: '👖', label: 'Pants' },
      { slot: 'shoes', icon: '👟', label: 'Shoes' },
    ];
    const shopNavigation = `
      <nav class="closet-shop-nav" aria-label="Clothing categories">
        ${shopCategories.map(({ slot, icon, label }) => `
          <button class="closet-category ${this.activeClosetSlotFilter === slot ? 'active' : ''}" data-action="filter-closet-slot" data-slot="${slot}" type="button" aria-pressed="${this.activeClosetSlotFilter === slot}">
            <span class="closet-category-icon" aria-hidden="true">${icon}</span>
            <span class="closet-category-label">${label}</span>
            <span class="closet-category-count">${CLOTHING_CATALOG.filter((item) => item.slot === slot).length} styles</span>
          </button>`).join('')}
      </nav>
      <div class="closet-shop-intro">
        <strong>Shop your whole outfit</strong>
        <button data-action="filter-closet-slot" data-slot="all" type="button" aria-pressed="${this.activeClosetSlotFilter === 'all'}">Browse all ${CLOTHING_CATALOG.length} styles →</button>
      </div>
    `;

    // Filter items according to activeClosetSlotFilter
    const allSlots: ClothingSlot[] = ['hat', 'jacket', 'pants', 'shoes'];
    const slotsToRender: ClothingSlot[] =
      this.activeClosetSlotFilter === 'all'
        ? allSlots
        : [this.activeClosetSlotFilter];

    const slotTitles: Record<ClothingSlot, string> = {
      hat: '🧢 Hats',
      jacket: '🧥 Jackets',
      pants: '👖 Pants',
      shoes: '👟 Shoes',
    };

    const searchTerm = this.closetSearch.trim().toLocaleLowerCase();
    const visibleCatalog = CLOTHING_CATALOG.filter((item) => {
      if (this.activeClosetSlotFilter !== 'all' && item.slot !== this.activeClosetSlotFilter) return false;
      if (searchTerm && !`${item.name} ${item.flavor}`.toLocaleLowerCase().includes(searchTerm)) return false;
      if (this.closetBrowseFilter === 'new' && !item.isNew) return false;
      if (this.closetBrowseFilter === 'owned' && !this.economy.ownsClothing(item.id)) return false;
      if (this.closetBrowseFilter === 'candy' && item.unlock.type !== 'premium') return false;
      if (this.closetBrowseFilter === 'ready' && !this.economy.ownsClothing(item.id)) {
        if (item.unlock.type === 'premium') {
          const premiumId = item.unlock.premiumId;
          const cost = PREMIUM_CATALOG.find((entry) => entry.id === premiumId)?.costCandyBars ?? Infinity;
          if (state.candyBars < cost) return false;
        } else if (state.coins < item.unlock.coins || Object.entries(item.unlock.materials ?? {})
          .some(([material, needed]) => (state.materials[material as keyof typeof state.materials] ?? 0) < (needed ?? 0))) return false;
      }
      return true;
    }).sort((a, b) => this.closetSort === 'name' ? a.name.localeCompare(b.name) : 0);

    const slotSections = slotsToRender.map((slot) => {
      const items = visibleCatalog.filter((item) => item.slot === slot);
      if (!items.length) return '';
      const rows = items.map((item) => {
        const owned = this.economy.ownsClothing(item.id);
        const equipped = state.equippedClothing[slot] === item.id;
        const unlock = item.unlock;

        // Calculate afford / unlock requirements
        let canAfford = false;
        let unlockMarkup = '';

        if (owned) {
          canAfford = true;
          unlockMarkup = '<span class="req-unlocked">Unlocked in Wardrobe</span>';
        } else if (unlock.type === 'premium') {
          const premDef = PREMIUM_CATALOG.find((p) => p.id === unlock.premiumId);
          const candyCost = premDef?.costCandyBars ?? 0;
          canAfford = state.candyBars >= candyCost;
          const shortCandy = !canAfford;
          unlockMarkup = `<span class="clothing-req-pill ${shortCandy ? 'cost-missing' : 'cost-met'}">${candyCost} ${CANDY_EMOJI} Candy Bars${shortCandy ? ` (have ${state.candyBars})` : ''}</span>`;
        } else {
          // Craft unlock: coins and materials
          const coinCost = unlock.coins;
          const shortCoins = state.coins < coinCost;
          const coinMarkup = coinCost > 0
            ? `<span class="clothing-req-pill ${shortCoins ? 'cost-missing' : 'cost-met'}">${coinCost}🪙${shortCoins ? ` (have ${state.coins})` : ''}</span>`
            : '<span class="clothing-req-pill cost-met">Free Starter</span>';

          const matParts: string[] = [];
          let matsMet = true;
          if (unlock.materials) {
            for (const [mat, needed] of Object.entries(unlock.materials)) {
              if (!needed) continue;
              const have = state.materials[mat as keyof typeof state.materials] ?? 0;
              const shortMat = have < needed;
              if (shortMat) matsMet = false;
              matParts.push(`<span class="clothing-req-pill ${shortMat ? 'cost-missing' : 'cost-met'}">${needed} ${mat}${shortMat ? ` (have ${have})` : ''}</span>`);
            }
          }
          canAfford = !shortCoins && matsMet;
          unlockMarkup = [coinMarkup, ...matParts].join(' ');
          if (!matsMet) unlockMarkup += '<span class="closet-material-tip">Recycle trash at the Crafting Bench for materials.</span>';
        }

        // Status badge: equipped / craftable / locked / owned
        let statusBadge = '';
        if (equipped) {
          statusBadge = '<span class="closet-status-pill status-equipped">Equipped ✨</span>';
        } else if (owned) {
          statusBadge = '<span class="closet-status-pill status-owned">Owned</span>';
        } else if (canAfford) {
          statusBadge = unlock.type === 'premium'
            ? '<span class="closet-status-pill status-available">Candy look</span>'
            : '<span class="closet-status-pill status-craftable">Craftable</span>';
        } else {
          statusBadge = unlock.type === 'premium'
            ? '<span class="closet-status-pill status-available">Candy look</span>'
            : '<span class="closet-status-pill status-locked">Not ready</span>';
        }

        const fallbackEmoji = slot === 'hat' ? '🎩' : slot === 'jacket' ? '🧥' : slot === 'pants' ? '👖' : '👢';

        const actionButton = actionFor(item);

        return `
          <li class="closet-card ${equipped ? 'is-equipped' : ''} ${this.previewClothingId === item.id ? 'is-previewing' : ''}">
            <div class="closet-card-art">${fashionThumbnail(item.id, item.name, fallbackEmoji)}</div>
            <div class="row-body">
              <div class="closet-item-header">
                <strong>${escapeWalletText(item.name)}</strong>
                ${statusBadge}
              </div>
              ${item.isNew ? '<span class="closet-new-tag">NEW LOOK</span>' : ''}
              <span class="row-meta closet-flavor">${escapeWalletText(item.flavor)}</span>
              <div class="row-meta closet-requirements">${unlockMarkup}</div>
            </div>
            <div class="closet-card-actions">
              <button class="btn-small" data-action="preview-clothing" data-id="${item.id}" type="button" aria-pressed="${this.previewClothingId === item.id}">Preview</button>
              ${actionButton}
            </div>
          </li>`;
      }).join('');
      return `<h4 class="modal-subhead">${slotTitles[slot]}</h4><ul class="closet-grid">${rows}</ul>`;
    }).join('');

    this.modalHost.innerHTML = this.modalShell(
      'Closet',
      `
        <div class="closet-preview-frame">
          <span class="mirror-label">YOUR OUTFIT · LIVE PREVIEW</span>
          <canvas id="closet-preview" width="320" height="400" aria-label="Live character outfit preview"></canvas>
          <span class="closet-turn-hint" aria-hidden="true">↻ Drag to turn</span>
        </div>
        ${shopNavigation}
        ${previewItem ? `<div class="try-on-detail" role="status"><div class="try-on-art">${clothingArt(previewItem.id, previewItem.slot)}</div><div class="try-on-copy"><strong>Previewing ${escapeWalletText(previewItem.name)}</strong><span>${previewCostText}</span><span>Shown on your avatar · try-on only until you wear or buy it.</span></div><div class="try-on-actions">${actionFor(previewItem)}<button class="btn-small" data-action="clear-clothing-preview" type="button">Clear</button></div></div>` : '<p class="modal-note try-on-hint">Drag to inspect your fisher and rod. Pick Preview on any look to try it on.</p>'}
        ${walletBanner}
        ${ensembleBanner}
        <h4 class="modal-subhead">Appearance</h4>
        <div class="closet-gender-row" role="radiogroup" aria-label="Angler character">
          <button class="btn-small closet-gender-btn ${this.economy.characterGender() === 'male' ? 'active' : ''}" data-action="set-character-gender" data-id="male" type="button" aria-pressed="${this.economy.characterGender() === 'male'}">Boy Angler</button>
          <button class="btn-small closet-gender-btn ${this.economy.characterGender() === 'female' ? 'active' : ''}" data-action="set-character-gender" data-id="female" type="button" aria-pressed="${this.economy.characterGender() === 'female'}">Girl Angler</button>
        </div>
        <div class="tone-swatch-row">${toneRow}</div>
        <section id="closet-collection" aria-label="Clothing styles">
          <h4 class="modal-subhead">${this.activeClosetSlotFilter === 'all' ? 'Browse all styles' : `${shopCategories.find((category) => category.slot === this.activeClosetSlotFilter)?.label} styles`}</h4>
          <div class="closet-collection-tools">
            <label class="closet-search-label">Find a look <input id="closet-search" type="search" value="${escapeWalletText(this.closetSearch)}" placeholder="Search styles" /></label>
            <div class="closet-search-actions"><button class="btn-small" data-action="search-closet" type="button">Search</button>${this.closetSearch ? '<button class="btn-small" data-action="clear-closet-search" type="button">Clear</button>' : ''}</div>
            <div class="closet-browse-filters" aria-label="Filter styles">
              ${([['all', 'All'], ['new', 'New'], ['owned', 'Owned'], ['candy', 'Candy'], ['ready', 'Ready now']] as const).map(([key, label]) => `<button class="${this.closetBrowseFilter === key ? 'active' : ''}" data-action="filter-closet-browse" data-id="${key}" type="button" aria-pressed="${this.closetBrowseFilter === key}">${label}</button>`).join('')}
            </div>
            <button class="closet-sort-btn" data-action="sort-closet" type="button">Sort: ${this.closetSort === 'catalog' ? 'Featured' : 'A–Z'} ↕</button>
          </div>
          <p class="closet-results-count">${visibleCatalog.length} ${visibleCatalog.length === 1 ? 'style' : 'styles'} shown · ${ownedCount} of ${CLOTHING_CATALOG.length} owned</p>
          ${slotSections || '<div class="closet-empty"><strong>No matching looks yet</strong><span>Try another category or clear the search and filters.</span><button class="btn-small" data-action="reset-closet-browse" type="button">Show all styles</button></div>'}
        </section>
      `,
    );
    this.bindModalActions();
    this.modalHost.querySelector<HTMLInputElement>('#closet-search')?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.closetSearch = (event.currentTarget as HTMLInputElement).value.trim();
      this.renderCloset();
      this.scrollClosetToCollection();
    });
    this.modalHost.querySelector<HTMLElement>('.modal-body')?.scrollTo({ top: previousScrollTop });
  }

  private renderCollection(): void {
    const userName = this.economy.displayName();

    if (!this.scrapbookOpened) {
      this.modalHost.innerHTML = this.modalShell(
        'Scrap Book',
        `
          <div class="scrapbook-cover-container" data-action="open-scrapbook">
            <div class="scrapbook-cover-book">
              <div class="scrapbook-cover-emboss">
                <div class="scrapbook-gold-corner tl"></div>
                <div class="scrapbook-gold-corner tr"></div>
                <div class="scrapbook-gold-corner bl"></div>
                <div class="scrapbook-gold-corner br"></div>
                <div class="scrapbook-crest">
                  <span class="scrapbook-tail-emoji">🐟</span>
                </div>
                <div class="scrapbook-author-text">${escapeWalletText(userName)}&apos;s</div>
                <h2 class="scrapbook-title-text">Big Fish Tails</h2>
                <div class="scrapbook-ornament-line"></div>
                <p class="scrapbook-tagline">Official Log of Record Catches &amp; Pond Lore</p>
                <button class="btn-primary scrapbook-open-btn" data-action="open-scrapbook" type="button">
                  Open Scrap Book 📖
                </button>
              </div>
            </div>
          </div>
        `,
      );
      const coverElem = this.modalHost.querySelector<HTMLElement>('.scrapbook-cover-container');
      coverElem?.addEventListener('click', () => {
        this.scrapbookOpened = true;
        this.renderCollection();
      });
      this.bindModalActions();
      return;
    }

    const discovered = new Set(this.economy.snapshot.discoveredCatchIds);
    let totalFishCaught = 0;
    let fishDiscoveredCount = 0;

    for (const fish of FISH_CATALOG) {
      const rec = this.economy.getFishRecord(fish.id);
      totalFishCaught += rec.count;
      if (rec.count > 0 || discovered.has(fish.id)) {
        fishDiscoveredCount += 1;
      }
    }

    const groups = RARITY_ORDER.filter((r) => r !== 'trash').map((rarity) => {
      const fishList = FISH_CATALOG.filter((f) => f.rarity === rarity);
      if (fishList.length === 0) return '';
      const rows = fishList.map((fish) => {
        const record = this.economy.getFishRecord(fish.id);
        const known = record.count > 0 || discovered.has(fish.id);
        const sprite = spriteFor(fish.id);
        const spriteMarkup = sprite
          ? `<div class="row-icon scrapbook-icon">${icon(sprite, known ? fish.name : 'undiscovered', known ? 'icon-img' : 'icon-img sprite-silhouette')}</div>`
          : '';
        const isTrophy = record.maxWeightKg > 0 && record.maxWeightKg >= fish.weightRangeKg[1] * 0.88;
        return `
          <li class="row scrapbook-row ${known ? '' : 'scrapbook-unknown'}">
            ${spriteMarkup}
            <div class="row-body scrapbook-row-body">
              <div class="scrapbook-row-head">
                <strong class="scrapbook-fish-name">${known ? fish.name : '???'}</strong>
                ${isTrophy ? '<span class="scrapbook-trophy-badge" title="Trophy Specimen!">⭐ Trophy</span>' : ''}
              </div>
              <div class="scrapbook-stats-bar">
                <span class="scrapbook-stat">Largest: <strong class="${isTrophy ? 'trophy-gold' : ''}">${record.maxWeightKg > 0 ? `${record.maxWeightKg.toFixed(2)} kg` : '&mdash;'}</strong></span>
                <span class="scrapbook-dot">&bull;</span>
                <span class="scrapbook-stat">Caught: <strong>${record.count}</strong></span>
              </div>
              <div class="scrapbook-range">Typical: ${fish.weightRangeKg[0].toFixed(2)} &ndash; ${fish.weightRangeKg[1].toFixed(2)} kg</div>
              <span class="row-meta scrapbook-flavor">${known ? fish.flavor : 'Not yet caught. Search the waters to land one!'}</span>
            </div>
          </li>`;
      }).join('');
      return `<h4 class="modal-subhead rarity-heading rarity-${rarity}">${rarity}</h4><ul class="modal-list">${rows}</ul>`;
    }).join('');

    const trashDiscovered = TRASH_CATALOG.filter((t) => discovered.has(t.id)).length;
    const trashRows = TRASH_CATALOG.map((trash) => {
      const known = discovered.has(trash.id);
      const sprite = spriteFor(trash.id);
      const spriteMarkup = sprite
        ? `<div class="row-icon">${icon(sprite, known ? trash.name : 'undiscovered', known ? 'icon-img' : 'icon-img sprite-silhouette')}</div>`
        : '';
      return `
        <li class="row scrapbook-row ${known ? '' : 'scrapbook-unknown'}">
          ${spriteMarkup}
          <div class="row-body">
            <strong>${known ? trash.name : '???'}</strong>
            <span class="row-meta">${known ? trash.flavor : 'Not yet discovered.'}</span>
          </div>
        </li>`;
    }).join('');

    this.modalHost.innerHTML = this.modalShell(
      'Scrap Book',
      `
        <div class="scrapbook-open-header">
          <div class="scrapbook-open-title">
            <span class="scrapbook-tail-badge">📖</span>
            <strong>${escapeWalletText(userName)}&apos;s Big Fish Tails</strong>
          </div>
          <button class="btn-small scrapbook-close-cover-btn" data-action="close-scrapbook" type="button">Close Book</button>
        </div>
        <p class="modal-note">${fishDiscoveredCount}/${FISH_CATALOG.length} Species Landed &middot; ${totalFishCaught} Total Fish Caught</p>
        ${groups}
        <h4 class="modal-subhead rarity-heading rarity-trash">Pond Salvage (${trashDiscovered}/${TRASH_CATALOG.length})</h4>
        <ul class="modal-list">${trashRows}</ul>
      `,
    );
    this.bindModalActions();
  }

  private renderSettings(): void {
    const mix = this.economy.snapshot.audio;
    this.modalHost.innerHTML = this.modalShell(
      'Settings',
      `
        <div class="settings-row">
          <label for="input-display-name">Display name</label>
          <input type="text" id="input-display-name" maxlength="24" placeholder="${escapeWalletText(this.economy.displayName())}" value="${escapeWalletText(this.economy.snapshot.displayNameOverride ?? '')}" />
        </div>
        <p class="modal-note">Your character is named after your Twitch display name automatically when playing as a Twitch extension. Set a name here to override it (handy for testing).</p>
        <div class="settings-row">
          <label for="vol-master">Master volume</label>
          <input type="range" id="vol-master" min="0" max="1" step="0.05" value="${mix.master}" />
        </div>
        <div class="settings-row">
          <label for="vol-sfx">Sound effects</label>
          <input type="range" id="vol-sfx" min="0" max="1" step="0.05" value="${mix.sfx}" />
        </div>
        <div class="settings-row">
          <label for="vol-ambience">Ambience</label>
          <input type="range" id="vol-ambience" min="0" max="1" step="0.05" value="${mix.ambience}" />
        </div>
        <div class="settings-row settings-row-checkbox">
          <label for="chk-mute">Mute all</label>
          <input type="checkbox" id="chk-mute" ${mix.muted ? 'checked' : ''} />
        </div>
        <p class="modal-note">Resetting erases your coins, basket, upgrades, and collection log.</p>
        <button class="btn-small btn-danger" id="btn-reset-save" type="button">${this.resetArmed ? 'Tap again to confirm' : 'Reset Save'}</button>
      `,
    );

    this.el('#input-display-name').addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.craftingSystem.setDisplayNameOverride(value.length > 0 ? value : null);
    });
    this.el('#vol-master').addEventListener('input', (e) => this.onVolumeChange('master', e));
    this.el('#vol-sfx').addEventListener('input', (e) => this.onVolumeChange('sfx', e));
    this.el('#vol-ambience').addEventListener('input', (e) => this.onVolumeChange('ambience', e));
    this.el('#chk-mute').addEventListener('change', (e) => {
      const muted = (e.target as HTMLInputElement).checked;
      this.audio.setMuted(muted);
      this.economy.setAudioMix({ muted });
      this.economy.persist();
    });
    this.el('#btn-reset-save').addEventListener('click', () => {
      if (!this.resetArmed) {
        this.resetArmed = true;
        this.renderSettings();
        return;
      }
      this.economy.resetSave();
      void Promise.race([
        this.economy.flushCloudSave(true),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
      ]).finally(() => window.location.reload());
    });
    this.bindModalActions();
  }

  private onVolumeChange(group: 'master' | 'sfx' | 'ambience', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.audio.setVolume(group, value);
    this.economy.setAudioMix({ [group]: value });
    this.economy.persist();
  }

  private modalShell(title: string, body: string, titleExtra = ''): string {
    return `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title-group">
            ${titleExtra}
            <h3>${title}</h3>
          </div>
          <button class="modal-close" data-action="close" type="button" aria-label="Close" title="Close">&times;</button>
        </div>
        <div class="modal-body">${body}</div>
      </div>
    `;
  }

  private bindModalActions(): void {
    this.modalHost.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        const id = button.dataset.id ?? '';
        const index = button.dataset.index ? Number(button.dataset.index) : -1;
        const slot = button.dataset.slot as ClothingSlot | undefined;

        if (action !== 'debug-wipe-user-data') {
          this.debugResetArmed = false;
        }

        let renderedModal = false;
        if (action === 'close') this.closeModal();
        else if (action === 'debug-wipe-user-data') {
          if (!this.debugResetArmed) {
            this.debugResetArmed = true;
            this.renderDebug();
            return;
          }
          this.debugResetArmed = false;
          this.economy.wipeUserData();
          void Promise.race([
            this.economy.flushCloudSave(true),
            new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
          ]).finally(() => window.location.reload());
          return;
        }
        else if (action === 'open-scrapbook') {
          this.scrapbookOpened = true;
          this.renderCollection();
          renderedModal = true;
        }
        else if (action === 'close-scrapbook') {
          this.scrapbookOpened = false;
          this.renderCollection();
          renderedModal = true;
        }
        else if (action === 'equip-bait') this.craftingSystem.equipBait(id);
        else if (action === 'buy-bait') {
          if (!this.craftingSystem.purchaseBait(id)) {
            this.barnabyMessage = 'Gulp, not enough money partner.';
            this.renderShop();
            this.showToast('Not enough 🪙');
          }
        }
        else if (action === 'buy-fishbot') this.craftingSystem.purchaseFishbot(id);
        else if (action === 'buy-bot-module') this.craftingSystem.purchaseBotModule(id, button.dataset.module as 'hopper' | 'unload' | 'salvage' | 'trophy');
        else if (action === 'set-bot-mode') {
          this.economy.setBotMode(id, button.dataset.mode as 'balanced' | 'salvage' | 'trophy');
          this.renderShop();
          renderedModal = true;
        }
        else if (action === 'claim-hopper') this.fishbotSystem.claimHopper();
        else if (action === 'sell') this.marketSystem.sell(index);
        else if (action === 'sell-all') this.marketSystem.sellAll();
        else if (action === 'buy-sorter-tray') {
          const unlocked = this.craftingSystem.purchaseSorterTray();
          if (unlocked) this.marketSystem.autoSellEligible();
          this.renderModal();
          renderedModal = true;
          if (unlocked) this.showToast('Sorter Tray unlocked! Common and uncommon auto sell are on.');
        }
        else if (action === 'toggle-auto-sell') {
          this.economy.toggleAutoSellRarity(id);
          this.marketSystem.autoSellEligible();
          this.renderMarket();
          renderedModal = true;
        }
        else if (action === 'buy-upgrade') this.craftingSystem.purchaseUpgrade(id as UpgradeId);
        else if (action === 'spend-skill-point') this.craftingSystem.spendSkillPoint(id as ArchetypeId);
        else if (action === 'recycle-all') this.craftingSystem.recycleAllTrash();
        else if (action === 'craft-ducky') this.craftingSystem.craftLuckyDucky();
        else if (action === 'use-ducky') this.craftingSystem.useLuckyDucky();
        else if (action === 'buy-candy-pack') this.muxySystem.purchaseCandyPack(id);
        else if (action === 'buy-premium') this.craftingSystem.purchasePremiumItem(id);
        else if (action === 'buy-material-bundle') this.craftingSystem.purchaseMaterialBundle(id);
        else if (action === 'buy-box-of-not-fish') {
          const contents = [...this.modalHost.querySelectorAll<HTMLInputElement>('input.box-quantity')].map((input) => ({ trashId: input.dataset.trashId ?? '', quantity: Number(input.value) }));
          if (contents.reduce((sum, entry) => sum + entry.quantity, 0) !== 20 || contents.some((entry) => !Number.isInteger(entry.quantity) || entry.quantity < 0)) this.showToast('Choose exactly 20 whole items.');
          else this.craftingSystem.purchaseBoxOfNotFish(contents);
        }
        else if (action === 'buy-clothing') this.craftingSystem.purchaseClothing(id);
        else if (action === 'debug-start-ui-tour') {
          this.startUiTour();
          return;
        }
        else if (action === 'open-candy-shop-from-closet') {
          this.closetReturnPreviewId = id || this.previewClothingId;
          this.returnToClosetFromCandy = true;
          this.toggleModal('candy');
          renderedModal = true;
        }
        else if (action === 'return-to-closet') {
          const returnPreview = this.closetReturnPreviewId;
          this.returnToClosetFromCandy = false;
          this.closetReturnPreviewId = null;
          if (returnPreview) {
            this.previewClothingId = returnPreview;
            this.events.emit('clothingPreviewChanged', { id: returnPreview });
          }
          this.toggleModal('closet');
          this.modalHost.querySelector<HTMLElement>('.modal-body')?.scrollTo({ top: 0 });
          renderedModal = true;
        }
        else if (action === 'equip-clothing' && slot) this.craftingSystem.equipClothing(slot, id);
        else if (action === 'unequip-clothing' && slot) this.craftingSystem.equipClothing(slot, null);
        else if (action === 'set-base-tone') this.craftingSystem.setBaseTone(id);
        else if (action === 'set-character-gender' && (id === 'male' || id === 'female')) {
          if (this.economy.setCharacterGender(id)) {
            this.syncTitleCharacterCards();
            this.events.emit('characterGenderChanged', { gender: id });
            this.renderCloset();
            this.modalHost.querySelector<HTMLElement>('.modal-body')?.scrollTo({ top: 0 });
            this.modalHost.querySelector<HTMLElement>('.closet-preview-frame')?.scrollIntoView({ block: 'start' });
            renderedModal = true;
          }
        }
        else if (action === 'preview-clothing' && CLOTHING_CATALOG.some((item) => item.id === id)) {
          this.previewClothingId = id;
          this.events.emit('clothingPreviewChanged', { id });
          this.renderCloset();
          this.modalHost.querySelector<HTMLElement>('.modal-body')?.scrollTo({ top: 0 });
          renderedModal = true;
        }
        else if (action === 'clear-clothing-preview') {
          this.previewClothingId = null;
          this.events.emit('clothingPreviewChanged', { id: null });
          this.renderCloset();
          renderedModal = true;
        }
        else if (action === 'save-outfit-preset') {
          this.economy.saveOutfitPreset(index);
          this.renderCloset();
          renderedModal = true;
          this.showToast('Outfit saved across channels.');
        }
        else if (action === 'wear-outfit-preset') {
          this.economy.wearOutfitPreset(index);
          this.events.emit('clothingEquipped', { slot: 'hat', id: this.economy.snapshot.equippedClothing.hat });
          this.events.emit('baseToneChanged', { id: this.economy.snapshot.baseToneId });
          this.events.emit('cosmeticEquipped', { slot: 'rod', id: this.economy.cosmeticEquipped('rod') });
          renderedModal = true;
          this.showToast('Saved outfit equipped.');
        }
        else if (action === 'equip-cosmetic') {
          const cosmeticSlot = button.dataset.slot as CosmeticSlot;
          if (this.economy.setCosmeticEquipped(cosmeticSlot, id || null)) {
            this.events.emit('cosmeticEquipped', { slot: cosmeticSlot, id: id || null });
            this.renderCandyShop();
            renderedModal = true;
          }
        }
        else if (action === 'filter-closet-slot') {
          const targetSlot = (button.dataset.slot ?? 'all') as 'all' | ClothingSlot;
          this.activeClosetSlotFilter = targetSlot;
          this.renderCloset();
          this.scrollClosetToCollection();
          renderedModal = true;
        }
        else if (action === 'search-closet') {
          this.closetSearch = (this.modalHost.querySelector<HTMLInputElement>('#closet-search')?.value ?? '').trim();
          this.renderCloset();
          this.scrollClosetToCollection();
          renderedModal = true;
        }
        else if (action === 'clear-closet-search') {
          this.closetSearch = '';
          this.renderCloset();
          this.scrollClosetToCollection();
          renderedModal = true;
        }
        else if (action === 'filter-closet-browse') {
          this.closetBrowseFilter = id as typeof this.closetBrowseFilter;
          this.renderCloset();
          this.scrollClosetToCollection();
          renderedModal = true;
        }
        else if (action === 'sort-closet') {
          this.closetSort = this.closetSort === 'catalog' ? 'name' : 'catalog';
          this.renderCloset();
          this.scrollClosetToCollection();
          renderedModal = true;
        }
        else if (action === 'reset-closet-browse') {
          this.closetSearch = '';
          this.closetBrowseFilter = 'all';
          this.activeClosetSlotFilter = 'all';
          this.renderCloset();
          this.scrollClosetToCollection();
          renderedModal = true;
        }
        else if (action === 'style-shuffle') {
          const slots: ClothingSlot[] = ['hat', 'jacket', 'pants', 'shoes'];
          for (const s of slots) {
            const owned = CLOTHING_CATALOG.filter((item) => item.slot === s && this.economy.ownsClothing(item.id));
            const pool: (string | null)[] = s === 'hat'
              ? [null, ...owned.map((i) => i.id)]
              : (owned.length > 0 ? owned.map((i) => i.id) : [null]);
            const chosenId = pool[Math.floor(Math.random() * pool.length)];
            this.economy.equipClothing(s, chosenId);
          }
          this.economy.persist();
          this.events.emit('clothingEquipped', { slot: 'hat', id: this.economy.snapshot.equippedClothing.hat });
          renderedModal = true;
          this.audio.getSynthesizer().playLevelUp();
          this.showToast('🎲 Style Shuffled! Looking sharp!');
        }
        else if (action === 'switch-quest-tab') {
          this.activeQuestTab = id as 'story' | 'daily' | 'milestones' | 'perks' | 'community' | 'lore';
          this.renderQuests();
          renderedModal = true;
        }
        else if (action === 'read-bottle') {
          this.activeReadingBottleId = id;
          this.renderQuests();
          renderedModal = true;
        }
        else if (action === 'close-bottle-reader') {
          this.activeReadingBottleId = null;
          this.renderQuests();
          renderedModal = true;
        }
        else if (action === 'buy-community-cheer') {
          if (this.communitySystem?.contributeCheer(id)) {
            this.showToast('Boost added to raid! ⚓🎉');
            this.renderQuests();
            renderedModal = true;
          } else {
            this.showToast('Need more Candy Bars! Visit the Candy Shop 🍫');
          }
        }
        else if (action === 'spawn-next-raid') {
          this.communitySystem?.spawnNextRaid();
          this.renderQuests();
          renderedModal = true;
        }
        else if (action === 'debug-discover-bottle') {
          const unowned = LORE_BOTTLES.find(b => !this.economy.hasDiscoveredBottle(b.id));
          if (unowned) {
            this.economy.discoverBottle(unowned.id);
            this.events.emit('loreBottleDiscovered', { bottle: unowned });
            this.showToast(`Uncorked: "${unowned.title}"!`);
            this.renderQuests();
          } else {
            this.showToast('All 10 lore bottles already discovered!');
          }
        }
        else if (action === 'debug-discover-relic') {
          const unowned = CURIO_RELICS.find(r => !this.economy.hasDiscoveredRelic(r.id));
          if (unowned) {
            this.economy.discoverRelic(unowned.id);
            this.events.emit('curioRelicDiscovered', { relic: unowned });
            this.showToast(`Recovered relic: "${unowned.name}"!`);
            this.renderQuests();
          } else {
            this.showToast('All 8 curio relics already recovered!');
          }
        }
        else if (action === 'debug-spawn-bottle-prop') {
          this.narrativeSystem?.spawnWaterBottle('bottle_murmuring_waters');
          this.showToast('Spawned 3D Message in a Bottle in water!');
        }
        else if (action === 'debug-barnaby-speak') {
          this.narrativeSystem?.showDialogue("Ahoy there! The waters are deep and full of wonders today.", 6, 'excited');
          this.showToast('Barnaby speech bubble triggered!');
        }
        else if (action === 'claim-chapter') {
          if (this.questSystem?.claimChapter(id)) {
            this.showToast('Chapter reward claimed! 📜🎉');
          }
        }
        else if (action === 'claim-daily-quest') {
          if (this.questSystem?.claimDailyQuest(id)) {
            this.showToast('Daily quest claimed! ⭐');
          }
        }
        else if (action === 'reroll-daily-quest') {
          if (this.questSystem?.rerollDailyQuest(id)) {
            this.showToast('Quest rerolled! 🎲');
          }
        }
        else if (action === 'claim-milestone') {
          if (this.questSystem?.claimMilestone(id)) {
            this.showToast('Milestone achieved! 🏆');
          }
        }
        else if (action === 'prestige') {
          if (this.economy.triggerPrestige()) {
            this.showToast('Ascended to Prestige Legend! 🌟');
          }
        }
        else if (action === 'equip-title') {
          this.economy.equipTitle(id);
          this.showToast(`Equipped title: ${id}`);
        }
        else if (action === 'debug-set-weather') {
          this.livingWorld?.setWeather(id as WeatherType, 300);
          this.showToast(`Weather set to ${id}`);
        }
        else if (action === 'debug-trigger-whale') {
          this.livingWorld?.triggerWhaleJump();
          this.showToast('Whale breach triggered! 🐋');
        }
        else if (action === 'debug-trigger-kraken') {
          this.livingWorld?.triggerKrakenJump();
          this.showToast('Kraken breach triggered! 🦑');
        }
        else if (action === 'debug-complete-raid') {
          if (this.communitySystem) {
            const goal = this.communitySystem.getActiveGoal();
            if (goal) {
              const boost = goal.targetValue - goal.currentValue;
              this.communitySystem.addProgress(Math.max(1, boost), 'Debug');
              this.showToast('Community Raid completed! ⚔️');
            }
          }
        }
        else if (action === 'debug-preview-raid-ticker') {
          const goal = this.communitySystem?.getActiveGoal();
          if (goal) this.events.emit('communityProgressUpdated', {
            goalId: goal.id,
            current: goal.currentValue,
            target: goal.targetValue,
            contributor: 'Demo Angler',
          });
        }
        else if (action === 'debug-add-xp') {
          const res = this.economy.addXp(500);
          this.events.emit('xpGained', { amount: 500, ...res });
          this.showToast('+500 XP granted!');
        }
        else if (action === 'debug-prestige') {
          this.economy.triggerPrestige();
          this.showToast(`Prestige rank: ${this.economy.prestige()}`);
        }
        else if (action === 'debug-toggle-perfect-cast') this.gameState.debugPerfectCastMode = !this.gameState.debugPerfectCastMode;
        else if (action === 'debug-toggle-auto-fish') this.gameState.autoFishingEnabled = !this.gameState.autoFishingEnabled;
        else if (action === 'debug-add-coins') {
          this.economy.addCoins(500);
          this.events.emit('coinsChanged', {});
        } else if (action === 'debug-add-garbage') this.craftingSystem.addRandomGarbage(5);
        else if (action === 'debug-force-treasure') {
          this.economy.setDebugForceNextCatch('treasure');
          this.showToast('Next successful catch will be a Sunken Coin Purse.');
        } else if (action === 'debug-toggle-coin-bottle') {
          this.economy.setLuckyCoinBottle(!this.economy.hasLuckyCoinBottle());
          this.renderDebug();
        } else if (action === 'debug-force-coin-bottle') {
          this.economy.setDebugForceNextCatch('lucky-coin-bottle');
          this.showToast('Next successful catch will be the Lucky Coin in a Bottle.');
        } else if (action === 'debug-start-tutorial') {
          this.economy.resetTutorial();
          this.baitTutorialStep = 0;
          this.dismissedFirstEscapeBubble = false;
          this.closeModal();
          this.renderTutorialBubble(this.gameState.getPhase());
          this.renderHud();
          this.showToast('Tutorial restarted! Cast your reel.');
        } else if (action === 'click-barnaby') {
          this.barnabyClickCount += 1;
          if (this.barnabyClickCount >= 5) {
            this.barnabyClickCount = 0;
            this.economy.setBakersDozenNextBait(true);
            this.barnabyMessage = BARNABY_5TH_CLICK_LINE;
          } else if (Math.random() < 0.25) {
            this.barnabyMessage = `Welcome, ${this.economy.displayName()}!`;
          } else {
            this.barnabyMessage = BARNABY_LINES[Math.floor(Math.random() * BARNABY_LINES.length)];
          }
        } else if (action === 'close-barnaby-message') {
          this.barnabyMessage = null;
        }

        this.renderHud();
        if (action !== 'close' && !renderedModal) this.renderModal();
      });
    });
  }

  private handleBaitClick(baitId: string): void {
    if (!['idle', 'aiming'].includes(this.gameState.getPhase())) return;
    const baitDef = BAIT_CATALOG.find((b) => b.id === baitId);
    if (!baitDef) return;

    const state = this.economy.snapshot;
    const owned = state.baitInventory[baitId] ?? 0;
    const isAvailable = baitDef.free || owned > 0;

    if (!isAvailable) {
      this.openShopForBait(baitId);
      return;
    }

    if (this.craftingSystem.equipBait(baitId)) {
      if (this.baitTutorialStep === 4 && baitId === 'marshmallows') {
        this.economy.markBaitTutorialCompleted();
        this.baitTutorialStep = 0;
        this.renderTutorialBubble(this.gameState.getPhase());
      }
      this.renderHud();
    }
  }

  private openShopForBait(baitId: string): void {
    this.requestedBaitFocus = baitId;
    if (this.openModal !== 'shop') {
      this.toggleModal('shop');
    } else {
      this.refreshOpenModal();
    }
  }

  private el(selector: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }
}
