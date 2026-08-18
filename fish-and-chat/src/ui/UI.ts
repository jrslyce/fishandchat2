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
  xpToNextLevel,
  type ArchetypeId,
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

type ModalId = 'shop' | 'market' | 'craft' | 'collection' | 'settings' | 'candy' | 'closet' | 'skills' | 'debug' | null;

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
  private readonly hudBaitName: HTMLElement;
  private readonly hudBasketCount: HTMLElement;
  private readonly basketBadge: HTMLElement;
  private readonly phaseIndicator: HTMLElement;
  private readonly fishbotStatus: HTMLElement;
  private readonly toastLine: HTMLElement;
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

  private openModal: ModalId = null;
  private railExpanded = false;
  private toastTimeout: number | null = null;
  private catchCardTimeout: number | null = null;
  private resetArmed = false;
  private lastDuckySecond = 0;
  private barnabyMessage: string | null = null;
  private barnabyClickCount = 0;
  private biteLabel = 'BITE! Tap now!';
  private missedLabel = 'It got away&hellip;';

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
          <div class="hud-pill hidden" id="hud-lucky-ducky-pill">🦆 <span id="hud-lucky-ducky-timer">0:00</span></div>
          <div class="hud-pill" id="hud-coins-pill">${icon(ICON.coin, 'Coins')}<span id="hud-coins">0</span></div>
          <button class="hud-pill hud-pill-button" id="hud-candy-pill" type="button">${CANDY_EMOJI}<span id="hud-candy-bars">0</span></button>
          <button class="hud-pill hud-pill-button" id="hud-bait-pill" type="button"><span id="hud-bait-name">&infin; PB</span></button>
        </div>
      </div>

      <div id="hud-rail">
        <button class="rail-btn" id="rail-toggle" type="button" aria-label="Menu" aria-expanded="false"><span class="gear-glyph">&#9776;</span></button>
        <div id="hud-rail-items" class="hidden">
          <button class="rail-btn" id="btn-shop" type="button" aria-label="Shop">${icon(ICON.bait, 'Shop')}</button>
          <button class="rail-btn" id="btn-market" type="button" aria-label="Market">${icon(ICON.coin, 'Market')}</button>
          <button class="rail-btn" id="btn-craft" type="button" aria-label="Crafting Bench">${icon(ICON.hammer, 'Craft')}</button>
          <button class="rail-btn" id="btn-candy" type="button" aria-label="Candy Bar Shop">${CANDY_EMOJI}</button>
          <button class="rail-btn" id="btn-closet" type="button" aria-label="Closet">&#128100;</button>
          <button class="rail-btn" id="btn-collection" type="button" aria-label="Collection">${icon(ICON.scale, 'Collection')}</button>
          <button class="rail-btn" id="btn-skills" type="button" aria-label="Skills"><span class="gear-glyph">&#11088;</span></button>
          <button class="rail-btn" id="btn-settings" type="button" aria-label="Settings"><span class="gear-glyph">&#9881;</span></button>
        </div>
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
        <button type="button" id="tutorial-bubble-text" class="tutorial-bubble-text"></button>
      </div>
      <div id="toast-line" class="hidden"></div>
      <div id="catch-card" class="hidden"></div>
      <div id="modal-host" class="hidden"></div>
      <div id="bite-flash"></div>
    `;

    this.hudLevel = this.el('#hud-level');
    this.hudXpFill = this.el('#hud-xp-fill');
    this.hudCoins = this.el('#hud-coins');
    this.hudCandyBars = this.el('#hud-candy-bars');
    this.hudBaitName = this.el('#hud-bait-name');
    this.hudBasketCount = this.el('#hud-basket-count');
    this.basketBadge = this.el('#basket-badge');
    this.phaseIndicator = this.el('#phase-indicator');
    this.fishbotStatus = this.el('#fishbot-status');
    this.biteFlash = document.querySelector<HTMLElement>('#bite-flash')!;
    this.toastLine = document.querySelector<HTMLElement>('#toast-line')!;
    this.catchCard = document.querySelector<HTMLElement>('#catch-card')!;
    this.modalHost = document.querySelector<HTMLElement>('#modal-host')!;
    this.titleScreen = document.querySelector<HTMLElement>('#title-screen')!;
    this.titleWelcome = document.querySelector<HTMLElement>('#title-welcome')!;
    this.titleStart = document.querySelector<HTMLButtonElement>('#title-start')!;
    this.titleLoading = document.querySelector<HTMLElement>('#title-loading')!;
    this.titleLoadingFill = document.querySelector<HTMLElement>('#title-loading-fill')!;
    this.tutorialBubble = this.el('#tutorial-bubble');
    this.tutorialBubbleText = this.el('#tutorial-bubble-text') as HTMLButtonElement;

    this.railToggle = this.el('#rail-toggle') as HTMLButtonElement;
    this.railItems = this.el('#hud-rail-items');
    this.railToggle.addEventListener('click', () => this.toggleRail());

    const railSelect = (id: ModalId) => {
      this.toggleModal(id);
      this.collapseRail();
    };
    this.el('#btn-shop').addEventListener('click', () => railSelect('shop'));
    this.el('#btn-market').addEventListener('click', () => railSelect('market'));
    this.el('#btn-craft').addEventListener('click', () => railSelect('craft'));
    this.el('#btn-candy').addEventListener('click', () => railSelect('candy'));
    this.el('#btn-closet').addEventListener('click', () => railSelect('closet'));
    this.el('#btn-collection').addEventListener('click', () => railSelect('collection'));
    this.el('#btn-skills').addEventListener('click', () => railSelect('skills'));
    this.el('#btn-settings').addEventListener('click', () => railSelect('settings'));
    this.el('#btn-debug').addEventListener('click', () => this.toggleModal('debug'));
    this.el('#hud-bait-pill').addEventListener('click', () => this.toggleModal('shop'));
    this.el('#hud-candy-pill').addEventListener('click', () => this.toggleModal('candy'));
    this.el('#basket-badge').addEventListener('click', () => this.toggleModal('market'));

    // Clicking the bubble itself dismisses it early — a real button, so this never bubbles
    // down to the canvas and accidentally fires a cast/reel tap underneath.
    this.tutorialBubbleText.addEventListener('click', () => {
      if (!this.economy.hasSeenCastTutorial()) this.economy.markCastTutorialSeen();
      else if (!this.economy.hasSeenReelTutorial()) this.economy.markReelTutorialSeen();
      this.renderTutorialBubble(this.gameState.getPhase());
    });

    this.titleStart.addEventListener('click', () => this.dismissTitleScreen());

    this.bindEvents();
    this.renderHud();
  }

  /** Call every frame. */
  update(): void {
    this.renderHud();
    this.renderPhaseIndicator();
  }

  dispose(): void {
    if (this.toastTimeout) window.clearTimeout(this.toastTimeout);
    if (this.catchCardTimeout) window.clearTimeout(this.catchCardTimeout);
    this.root.remove();
  }

  private dismissTitleScreen(): void {
    this.titleScreen?.classList.add('hidden');
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
    // Tutorial bubbles auto-close the instant the described action actually happens, rather
    // than waiting for the player to notice and dismiss them by hand.
    this.events.on('castLocked', () => {
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
    this.events.on('catchResolved', ({ result }) => this.showCatchCard(result));
    this.events.on('coinsChanged', () => this.refreshOpenModal());
    this.events.on('upgradePurchased', () => this.refreshOpenModal());
    this.events.on('skillPointSpent', () => this.refreshOpenModal());
    this.events.on('baitPurchased', () => this.refreshOpenModal());
    this.events.on('baitEquipped', () => this.refreshOpenModal());
    this.events.on('fishbotPurchased', () => this.refreshOpenModal());
    this.events.on('fishbotEquipped', () => this.refreshOpenModal());
    this.events.on('fishbotClaimed', () => this.refreshOpenModal());
    this.events.on('candyBarsChanged', () => this.refreshOpenModal());
    this.events.on('premiumItemPurchased', () => this.refreshOpenModal());
    this.events.on('materialBundlePurchased', () => this.refreshOpenModal());
    this.events.on('boxOfNotFishOpened', () => this.refreshOpenModal());
    this.events.on('clothingPurchased', () => this.refreshOpenModal());
    this.events.on('clothingEquipped', () => this.refreshOpenModal());
    this.events.on('baseToneChanged', () => this.refreshOpenModal());
    this.events.on('marketSold', (event) => {
      this.refreshOpenModal();
      if (event.method === 'haggle') {
        const msg = event.success 
          ? `Haggle successful! Sold for ${event.value} coins.` 
          : `Barnaby groaned and dropped the price to ${event.value} coins.`;
        this.showToast(msg);
      } else if (event.method === 'desperate') {
        const msg = event.success 
          ? `Desperate plea worked! Sold for ${event.value} coins.` 
          : `Barnaby sneered and bought it for a meager ${event.value} coins.`;
        this.showToast(msg);
      }
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
    const equippedBait = this.economy.equippedBait();
    const baitOwned = state.baitInventory[equippedBait.id] ?? 0;
    this.hudBaitName.textContent = `${equippedBait.free ? '∞' : baitOwned} ${equippedBait.acronym}`;
    const basketCap = this.economy.basketCapacity();
    this.hudBasketCount.textContent = `${state.basket.length}/${basketCap}`;
    // The badge is the only always-visible surface for capacity, so it carries
    // the pressure that motivates the Heavy Duty Basket upgrade: amber when
    // two slots from full, red once catches start bouncing.
    this.basketBadge.classList.toggle('basket-full', state.basket.length >= basketCap);
    this.basketBadge.classList.toggle('basket-warn', state.basket.length < basketCap && state.basket.length >= basketCap - 2);

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
   * Barnaby's two one-time onboarding bubbles, driven purely by economy flags + current phase
   * (no separate stage tracking to fall out of sync) — recomputed every frame:
   * "click to cast" while idle/aiming, then "tap to reel" once cast until the first bite is
   * reacted to. Both also auto-close via `bindEvents()`'s `castLocked`/`biteReacted` listeners.
   */
  private renderTutorialBubble(phase: FishingPhase): void {
    let text: string | null = null;

    if (!this.economy.hasSeenCastTutorial() && (phase === 'idle' || phase === 'aiming')) {
      text = 'Click on the screen to cast your reel.';
    } else if (
      this.economy.hasSeenCastTutorial() &&
      !this.economy.hasSeenReelTutorial() &&
      (phase === 'casting' || phase === 'waiting' || phase === 'bite')
    ) {
      text = 'Once you have a bite, tap the screen to reel in.';
    }

    if (text) {
      this.tutorialBubbleText.textContent = text;
      this.tutorialBubble.classList.remove('hidden');
    } else {
      this.tutorialBubble.classList.add('hidden');
    }
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

  private toggleModal(id: ModalId): void {
    const previous = this.openModal;
    this.openModal = this.openModal === id ? null : id;
    if (this.openModal === 'market') this.marketSystem.onMarketOpened();
    if (previous === 'closet' && this.openModal !== 'closet') this.events.emit('closetClosed', {});
    if (this.openModal === 'closet' && previous !== 'closet') this.events.emit('closetOpened', {});
    this.resetArmed = false;
    this.renderModal();
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
    else if (this.openModal === 'debug') this.renderDebug();
    const newModalBody = this.modalHost.querySelector('.modal-body');
    if (newModalBody) newModalBody.scrollTop = scrollTop;
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

  private renderDebug(): void {
    const perfectCastOn = this.gameState.debugPerfectCastMode;
    const autoFishOn = this.gameState.autoFishingEnabled;

    this.modalHost.innerHTML = this.modalShell(
      'Debug',
      `
        <ul class="modal-list">
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
        </ul>
      `,
    );
    this.bindModalActions();
  }

  private renderShop(): void {
    const state = this.economy.snapshot;
    const baitRows = BAIT_CATALOG.map((bait) => {
      const owned = state.baitInventory[bait.id] ?? 0;
      const equipped = state.equippedBaitId === bait.id;
      const canEquip = bait.free || owned > 0;
      const equipDisabled = equipped || !canEquip;
      return `
        <li class="row">
          ${rowIcon(bait.id, bait.name, icon(ICON.bait, bait.name))}
          <div class="row-body">
            <strong>${bait.name}</strong>
            <span class="row-meta">${bait.free ? 'always available' : `${bait.costPerTen}🪙 / 10`} &middot; have ${bait.free ? '&infin;' : owned}</span>
          </div>
          <div class="row-actions">
            <button class="btn-small ${equipDisabled ? 'btn-disabled' : ''}" data-action="equip-bait" data-id="${bait.id}" ${equipDisabled ? 'disabled' : ''}>${equipped ? 'Equipped' : 'Equip'}</button>
            ${bait.free ? '' : `<button class="btn-small" data-action="buy-bait" data-id="${bait.id}">Buy 10</button>`}
          </div>
        </li>`;
    }).join('');

    const botRows = FISHBOT_CATALOG.map((bot) => {
      const botState = state.fishbots[bot.id];
      const owned = botState?.owned;
      const equipped = state.equippedFishbotId === bot.id;
      const secondsToNext = equipped ? Math.max(0, Math.ceil((botState!.nextReadyAtMs - Date.now()) / 1000)) : 0;
      const statusLine = equipped
        ? secondsToNext > 0
          ? `<span class="row-meta">🟢 Active — next catch in ${secondsToNext}s</span>`
          : `<span class="row-meta">🟢 Active — catch ready, check the hopper below</span>`
        : owned
          ? `<span class="row-meta">In holdings — not fishing</span>`
          : '';
      const actionButton = !owned
        ? `<button class="btn-small" data-action="buy-fishbot" data-id="${bot.id}">Buy</button>`
        : `<button class="btn-small ${equipped ? 'btn-disabled' : ''}" data-action="equip-fishbot" data-id="${bot.id}" ${equipped ? 'disabled' : ''}>${equipped ? 'Equipped' : 'Equip'}</button>`;
      return `
        <li class="row">
          ${rowIcon(bot.id, bot.name)}
          <div class="row-body">
            <strong>${bot.name}</strong>
            <span class="row-meta">${bot.cost}🪙 &middot; ${bot.baseIntervalSeconds}s cycle</span>
            ${statusLine}
          </div>
          <div class="row-actions">${actionButton}</div>
        </li>`;
    }).join('');

    const hopperCount = state.fishbotHopper.length;
    const trashCount = this.economy.trashBucket().length;

    const barnabyHeader = `
      <div class="barnaby-header-slot">
        <button class="barnaby-portrait-btn" data-action="click-barnaby" type="button" aria-label="Barnaby">
          <img class="barnaby-portrait-small" src="./images/barnaby-portrait.png" alt="Barnaby" />
        </button>
        ${this.barnabyMessage ? `<button class="barnaby-bubble" type="button" data-action="close-barnaby-message">${this.barnabyMessage} <em>*gulp*</em></button>` : ''}
      </div>
    `;

    this.modalHost.innerHTML = this.modalShell(
      'Shop',
      `
        <div class="craft-actions-row">
          <span class="craft-trash-count">Trash bucket: ${trashCount} (unlimited)</span>
          <button class="btn-small" data-action="recycle-all" ${trashCount === 0 ? 'disabled' : ''}>Recycle All</button>
        </div>
        <h4 class="modal-subhead">Bait</h4>
        <ul class="modal-list">${baitRows}</ul>
        <h4 class="modal-subhead">Fishbots</h4>
        <ul class="modal-list">${botRows}</ul>
        <p class="modal-note">Hopper: ${hopperCount}/10 <button class="btn-small" data-action="claim-hopper" ${hopperCount === 0 ? 'disabled' : ''}>Claim</button></p>
      `,
      barnabyHeader,
    );
    this.bindModalActions();
  }

  private renderMarket(): void {
    const state = this.economy.snapshot;

    const rows = state.basket.map((item, index) => {
      if (item.isTrash) return '';
      const species = FISH_CATALOG.find((f) => f.id === item.catchId);
      const value = species ? Math.round(species.baseValue * this.economy.saleMultiplier()) : 0;
      return `
        <li class="row">
          ${rowIcon(item.catchId, catchName(item.catchId))}
          <div class="row-body">
            <strong>${catchName(item.catchId)}</strong>
            <span class="row-meta">${item.weightKg.toFixed(2)}kg &middot; ${value} ${icon(ICON.coin, 'coins', 'inline-icon')}</span>
          </div>
          <div class="row-actions">
            <button class="btn-small" data-action="sell" data-method="sell" data-index="${index}">Sell</button>
          </div>
        </li>`;
    }).join('');

    const sellableCount = state.basket.filter((item) => !item.isTrash).length;
    const bulkBtnClass = `btn-small${sellableCount === 0 ? ' btn-disabled' : ''}`;
    const bulkBtnDisabled = sellableCount === 0 ? 'disabled' : '';

    this.modalHost.innerHTML = this.modalShell(
      "Monger Barnaby's Market",
      `
        <div class="market-header">
          <img class="barnaby-portrait" src="./images/barnaby-portrait.png" alt="Monger Barnaby" />
          ${this.basketCapacityMarkup()}
        </div>
        <div class="market-bulk-row">
          <button class="${bulkBtnClass}" data-action="sell-all" data-method="sell" ${bulkBtnDisabled}>Sell All</button>
        </div>
        <ul class="modal-list">${rows || '<li class="row modal-empty">Basket is empty. Go catch something!</li>'}</ul>
      `,
    );
    this.bindModalActions();
  }

  /**
   * Capacity readout + a route to the upgrade that raises it. Basket size is
   * already upgradable (Heavy Duty Basket / Tackle Apron in UPGRADE_CATALOG),
   * but it was only reachable by scrolling the generic upgrade list — so the
   * cap read as a fixed wall rather than something to grind toward. Shown
   * wherever the player is confronted with the limit.
   */
  private basketCapacityMarkup(): string {
    const used = this.economy.snapshot.basket.length;
    const cap = this.economy.basketCapacity();
    const tight = used >= cap;
    const nearlyFull = !tight && used >= cap - 2;
    const state = tight ? 'capacity-full' : nearlyFull ? 'capacity-warn' : '';
    const canExpand = this.economy.upgradeTier('heavy-duty-basket') < 4 || this.economy.upgradeTier('tackle-apron') < 1;
    return `
      <div class="capacity-readout ${state}">
        <span>Basket ${used}/${cap}</span>
        ${canExpand ? '<button class="btn-small" data-action="open-craft">Expand</button>' : ''}
      </div>`;
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

    const packRows = CANDY_BAR_PACKS.map((pack) => `
      <li class="row">
        <div class="row-body">
          <strong>${pack.name}</strong>
          <span class="row-meta">${pack.bitsCost} Bits &rarr; ${pack.candyBars} ${CANDY_EMOJI}</span>
        </div>
        <div class="row-actions">
          <button class="btn-small" data-action="buy-candy-pack" data-id="${pack.id}">${this.muxySystem.isConfigured ? 'Buy with Bits' : 'Buy (Debug)'}</button>
        </div>
      </li>`).join('');

    const premiumRows = PREMIUM_CATALOG.map((item) => {
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

    const boxCanAfford = state.candyBars >= BOX_OF_NOT_FISH_COST_CANDY_BARS;
    const boxContentsLabel = BOX_OF_NOT_FISH_CONTENTS.map((entry) => `${entry.quantity}&times; ${catchName(entry.trashId)}`).join(', ');

    const bundleRows = MATERIAL_BUNDLE_CATALOG.map((bundle) => {
      const canAfford = state.candyBars >= bundle.costCandyBars;
      return `
        <li class="row">
          ${rowIcon(bundle.materialId, bundle.materialId)}
          <div class="row-body">
            <strong>${bundle.quantity}&times; ${bundle.materialId}</strong>
            <span class="row-meta">${bundle.costCandyBars} ${CANDY_EMOJI}</span>
          </div>
          <div class="row-actions">
            <button class="btn-small ${!canAfford ? 'btn-disabled' : ''}" data-action="buy-material-bundle" data-id="${bundle.id}" ${!canAfford ? 'disabled' : ''}>Buy</button>
          </div>
        </li>`;
    }).join('');

    this.modalHost.innerHTML = this.modalShell(
      'Candy Bar Shop',
      `
        <h4 class="modal-subhead">Get Candy Bars</h4>
        <ul class="modal-list">${packRows}</ul>

        <h4 class="modal-subhead">Premium Items</h4>
        <ul class="modal-list">${premiumRows}</ul>

        <h4 class="modal-subhead">Box of Not Fish</h4>
        <ul class="modal-list">
          <li class="row">
            <div class="row-body">
              <strong>Box of Not Fish</strong>
              <span class="row-meta">Contains exactly: ${boxContentsLabel}</span>
              <span class="row-meta">${BOX_OF_NOT_FISH_COST_CANDY_BARS} ${CANDY_EMOJI}</span>
            </div>
            <div class="row-actions">
              <button class="btn-small ${!boxCanAfford ? 'btn-disabled' : ''}" data-action="buy-box-of-not-fish" ${!boxCanAfford ? 'disabled' : ''}>Buy</button>
            </div>
          </li>
        </ul>

        <h4 class="modal-subhead">Material Bundles</h4>
        <ul class="modal-list">${bundleRows}</ul>
      `,
    );
    this.bindModalActions();
  }

  private renderCloset(): void {
    const state = this.economy.snapshot;

    const toneRow = BASE_TONE_CATALOG.map((tone) => {
      const active = state.baseToneId === tone.id;
      return `<button class="tone-swatch ${active ? 'tone-swatch-active' : ''}" data-action="set-base-tone" data-id="${tone.id}" style="background:${tone.color}" title="${tone.name}" aria-label="${tone.name}"></button>`;
    }).join('');

    // Hat and jacket only. At the size the character renders in a portrait
    // Twitch panel, legs and feet are a handful of pixels — pants/shoes cost
    // closet scrolling and art budget for variety nobody can actually see.
    // Their slots still exist in save state and still render their basics
    // (see SaveState's equippedClothing defaults); they're just not customizable.
    const slots: ClothingSlot[] = ['hat', 'jacket'];
    const slotSections = slots.map((slot) => {
      const items = CLOTHING_CATALOG.filter((item) => item.slot === slot);
      const rows = items.map((item) => {
        const owned = this.economy.ownsClothing(item.id);
        const equipped = state.equippedClothing[slot] === item.id;
        const unlock = item.unlock;
        const costLabel =
          unlock.type === 'premium'
            ? `${PREMIUM_CATALOG.find((p) => p.id === unlock.premiumId)?.costCandyBars ?? '?'} ${CANDY_EMOJI}`
            : `${unlock.coins}🪙${
                unlock.materials
                  ? `, ${Object.entries(unlock.materials).map(([m, a]) => `${a} ${m}`).join(', ')}`
                  : ''
              }`;
        const canAfford =
          unlock.type === 'premium'
            ? state.candyBars >= (PREMIUM_CATALOG.find((p) => p.id === unlock.premiumId)?.costCandyBars ?? Infinity)
            : state.coins >= unlock.coins &&
              Object.entries(unlock.materials ?? {}).every(([m, a]) => (state.materials[m as keyof typeof state.materials] ?? 0) >= (a ?? 0));

        return `
          <li class="row">
            ${rowIcon(item.id, item.name)}
            <div class="row-body">
              <strong>${item.name}</strong>
              <span class="row-meta">${item.flavor}</span>
              <span class="row-meta">${owned ? 'Owned' : costLabel}</span>
            </div>
            <div class="row-actions">
              ${
                owned
                  ? `<button class="btn-small" data-action="${equipped ? 'unequip-clothing' : 'equip-clothing'}" data-slot="${slot}" data-id="${item.id}">${equipped ? 'Unequip' : 'Equip'}</button>`
                  : `<button class="btn-small ${!canAfford ? 'btn-disabled' : ''}" data-action="buy-clothing" data-id="${item.id}" ${!canAfford ? 'disabled' : ''}>Buy</button>`
              }
            </div>
          </li>`;
      }).join('');
      return `<h4 class="modal-subhead">${slot}</h4><ul class="modal-list">${rows}</ul>`;
    }).join('');

    this.modalHost.innerHTML = this.modalShell(
      'Closet',
      `
        <div class="closet-preview-frame">
          <canvas id="closet-preview" width="220" height="280"></canvas>
        </div>
        <h4 class="modal-subhead">Appearance</h4>
        <div class="tone-swatch-row">${toneRow}</div>
        ${slotSections}
      `,
    );
    this.bindModalActions();
  }

  private renderCollection(): void {
    const discovered = new Set(this.economy.snapshot.discoveredCatchIds);
    const groups = RARITY_ORDER.map((rarity) => {
      const entries =
        rarity === 'trash'
          ? TRASH_CATALOG.map((t) => ({ id: t.id, name: t.name, flavor: t.flavor }))
          : FISH_CATALOG.filter((f) => f.rarity === rarity).map((f) => ({ id: f.id, name: f.name, flavor: f.flavor }));
      const rows = entries.map((entry) => {
        const known = discovered.has(entry.id);
        const sprite = spriteFor(entry.id);
        const spriteMarkup = sprite
          ? `<div class="row-icon">${icon(sprite, known ? entry.name : 'undiscovered', known ? 'icon-img' : 'icon-img sprite-silhouette')}</div>`
          : '';
        return `
          <li class="row collection-row ${known ? '' : 'collection-unknown'}">
            ${spriteMarkup}
            <div class="row-body">
              <strong>${known ? entry.name : '???'}</strong>
              <span class="row-meta">${known ? entry.flavor : 'Not yet discovered.'}</span>
            </div>
          </li>`;
      }).join('');
      return `<h4 class="modal-subhead rarity-heading rarity-${rarity}">${rarity}</h4><ul class="modal-list">${rows}</ul>`;
    }).join('');

    const total = FISH_CATALOG.length + TRASH_CATALOG.length;
    this.modalHost.innerHTML = this.modalShell(
      'Collection',
      `<p class="modal-note">${discovered.size}/${total} discovered</p>${groups}`,
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
          <input type="text" id="input-display-name" maxlength="24" placeholder="${this.economy.displayName()}" value="${this.economy.snapshot.displayNameOverride ?? ''}" />
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
      window.location.reload();
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
          <button class="modal-close" data-action="close" type="button" aria-label="Close">&times;</button>
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
        const method = button.dataset.method as 'sell' | 'haggle' | 'desperate' | undefined;
        const slot = button.dataset.slot as ClothingSlot | undefined;

        if (action === 'close') this.toggleModal(this.openModal);
        else if (action === 'equip-bait') this.craftingSystem.equipBait(id);
        else if (action === 'buy-bait') {
          if (!this.craftingSystem.purchaseBait(id)) this.showToast('Not enough 🪙');
        }
        else if (action === 'buy-fishbot') this.craftingSystem.purchaseFishbot(id);
        else if (action === 'equip-fishbot') this.craftingSystem.equipFishbot(id);
        else if (action === 'claim-hopper') this.fishbotSystem.claimHopper();
        else if (action === 'sell' && method) this.marketSystem.sell(index, method);
        else if (action === 'sell-all' && method === 'sell') this.marketSystem.sellAll(method);
        else if (action === 'open-craft') this.toggleModal('craft');
        else if (action === 'buy-upgrade') this.craftingSystem.purchaseUpgrade(id as UpgradeId);
        else if (action === 'spend-skill-point') this.craftingSystem.spendSkillPoint(id as ArchetypeId);
        else if (action === 'recycle-all') this.craftingSystem.recycleAllTrash();
        else if (action === 'craft-ducky') this.craftingSystem.craftLuckyDucky();
        else if (action === 'use-ducky') this.craftingSystem.useLuckyDucky();
        else if (action === 'buy-candy-pack') this.muxySystem.purchaseCandyPack(id);
        else if (action === 'buy-premium') this.craftingSystem.purchasePremiumItem(id);
        else if (action === 'buy-material-bundle') this.craftingSystem.purchaseMaterialBundle(id);
        else if (action === 'buy-box-of-not-fish') this.craftingSystem.purchaseBoxOfNotFish();
        else if (action === 'buy-clothing') this.craftingSystem.purchaseClothing(id);
        else if (action === 'equip-clothing' && slot) this.craftingSystem.equipClothing(slot, id);
        else if (action === 'unequip-clothing' && slot) this.craftingSystem.equipClothing(slot, null);
        else if (action === 'set-base-tone') this.craftingSystem.setBaseTone(id);
        else if (action === 'debug-toggle-perfect-cast') this.gameState.debugPerfectCastMode = !this.gameState.debugPerfectCastMode;
        else if (action === 'debug-toggle-auto-fish') this.gameState.autoFishingEnabled = !this.gameState.autoFishingEnabled;
        else if (action === 'debug-add-coins') {
          this.economy.addCoins(500);
          this.events.emit('coinsChanged', {});
        } else if (action === 'debug-add-garbage') this.craftingSystem.addRandomGarbage(5);
        else if (action === 'debug-force-treasure') {
          this.economy.setDebugForceNextCatch('treasure');
          this.showToast('Next successful catch will be a Sunken Coin Purse.');
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
        if (action !== 'close') this.renderModal();
      });
    });
  }

  private el(selector: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }
}
