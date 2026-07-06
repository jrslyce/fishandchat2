import {
  BAIT_CATALOG,
  FISH_CATALOG,
  FISHBOT_CATALOG,
  RARITY_ORDER,
  TRASH_CATALOG,
  UPGRADE_CATALOG,
  xpToNextLevel,
  type UpgradeId,
} from '../game/data';
import type { Economy, RecycleResult } from '../game/Economy';
import { SPRITE_MANIFEST } from '../assets/spriteManifest';
import type { AudioEngine } from '../core/AudioEngine';
import type { CraftingSystem } from '../systems/CraftingSystem';
import type { FishbotSystem } from '../systems/FishbotSystem';
import type { FishingStateMachine } from '../game/GameState';
import type { MarketSystem } from '../systems/MarketSystem';
import type { EventBus } from '../core/EventBus';
import type { CatchResult, GameEventMap } from '../game/events';

type ModalId = 'shop' | 'market' | 'craft' | 'collection' | 'settings' | null;

const ICON = {
  coin: '/images/icons/coin.png',
  bait: '/images/icons/bait.png',
  basket: '/images/icons/basket.png',
  hammer: '/images/icons/hammer.png',
  scale: '/images/icons/scale.png',
  bone: '/images/icons/bone.png',
} as const;

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
  private readonly hudBaitName: HTMLElement;
  private readonly hudBasketCount: HTMLElement;
  private readonly phaseIndicator: HTMLElement;
  private readonly toastLine: HTMLElement;
  private readonly catchCard: HTMLElement;
  private readonly modalHost: HTMLElement;
  private readonly titleScreen: HTMLElement;
  private readonly actionButton: HTMLButtonElement;

  private openModal: ModalId = null;
  private toastTimeout: number | null = null;
  private catchCardTimeout: number | null = null;
  private resetArmed = false;
  private lastDuckySecond = 0;

  constructor(
    private readonly economy: Economy,
    private readonly gameState: FishingStateMachine,
    private readonly marketSystem: MarketSystem,
    private readonly craftingSystem: CraftingSystem,
    private readonly fishbotSystem: FishbotSystem,
    private readonly audio: AudioEngine,
    private readonly events: EventBus<GameEventMap>,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'ui-root';
    document.querySelector('#app')?.appendChild(this.root);

    this.root.innerHTML = `
      <div id="hud-top">
        <div id="hud-level-block">
          <span id="hud-level">Lv 1</span>
          <div id="hud-xp-bar"><div id="hud-xp-fill"></div></div>
        </div>
        <div id="hud-pills">
          <div class="hud-pill hidden" id="hud-lucky-ducky-pill">🦆 <span id="hud-lucky-ducky-timer">0:00</span></div>
          <div class="hud-pill" id="hud-coins-pill">${icon(ICON.coin, 'Coins')}<span id="hud-coins">0</span></div>
          <button class="hud-pill hud-pill-button" id="hud-bait-pill" type="button">${icon(ICON.bait, 'Bait')}<span id="hud-bait-name">Pleb Bait</span></button>
        </div>
      </div>

      <div id="hud-rail">
        <button class="rail-btn" id="btn-shop" type="button" aria-label="Shop">${icon(ICON.bait, 'Shop')}</button>
        <button class="rail-btn" id="btn-market" type="button" aria-label="Market">${icon(ICON.coin, 'Market')}</button>
        <button class="rail-btn" id="btn-craft" type="button" aria-label="Crafting Bench">${icon(ICON.hammer, 'Craft')}</button>
        <button class="rail-btn" id="btn-collection" type="button" aria-label="Collection">${icon(ICON.scale, 'Collection')}</button>
        <button class="rail-btn" id="btn-settings" type="button" aria-label="Settings"><span class="gear-glyph">&#9881;</span></button>
      </div>

      <button id="basket-badge" type="button" aria-label="Basket">
        ${icon(ICON.basket, 'Basket')}
        <span id="hud-basket-count">0/8</span>
      </button>

      <div id="phase-indicator"></div>
      <div id="toast-line" class="hidden"></div>
      <div id="catch-card" class="hidden"></div>
      <div id="modal-host" class="hidden"></div>
    `;

    this.hudLevel = this.el('#hud-level');
    this.hudXpFill = this.el('#hud-xp-fill');
    this.hudCoins = this.el('#hud-coins');
    this.hudBaitName = this.el('#hud-bait-name');
    this.hudBasketCount = this.el('#hud-basket-count');
    this.phaseIndicator = this.el('#phase-indicator');
    this.toastLine = document.querySelector<HTMLElement>('#toast-line')!;
    this.catchCard = document.querySelector<HTMLElement>('#catch-card')!;
    this.modalHost = document.querySelector<HTMLElement>('#modal-host')!;
    this.titleScreen = document.querySelector<HTMLElement>('#title-screen')!;
    this.actionButton = document.querySelector<HTMLButtonElement>('#action-button')!;

    this.el('#btn-shop').addEventListener('click', () => this.toggleModal('shop'));
    this.el('#btn-market').addEventListener('click', () => this.toggleModal('market'));
    this.el('#btn-craft').addEventListener('click', () => this.toggleModal('craft'));
    this.el('#btn-collection').addEventListener('click', () => this.toggleModal('collection'));
    this.el('#btn-settings').addEventListener('click', () => this.toggleModal('settings'));
    this.el('#hud-bait-pill').addEventListener('click', () => this.toggleModal('shop'));
    this.el('#basket-badge').addEventListener('click', () => this.toggleModal('market'));

    document.querySelector('#title-start')?.addEventListener('click', () => this.dismissTitleScreen());

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

  private bindEvents(): void {
    this.events.on('toast', ({ message }) => this.showToast(message));
    // 'missed' needs no listener here: GameState already emits a toast for it.
    this.events.on('catchResolved', ({ result }) => this.showCatchCard(result));
    this.events.on('coinsChanged', () => this.refreshOpenModal());
    this.events.on('upgradePurchased', () => this.refreshOpenModal());
    this.events.on('baitPurchased', () => this.refreshOpenModal());
    this.events.on('baitEquipped', () => this.refreshOpenModal());
    this.events.on('fishbotPurchased', () => this.refreshOpenModal());
    this.events.on('fishbotClaimed', () => this.refreshOpenModal());
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
    
    const actionBtn = this.actionButton;
    const rect = actionBtn.getBoundingClientRect();
    dice.style.left = `${rect.left + rect.width / 2}px`;
    dice.style.top = `${rect.top - 50}px`;
    
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
    this.hudBaitName.textContent = this.economy.equippedBait().name;
    this.hudBasketCount.textContent = `${state.basket.length}/${this.economy.basketCapacity()}`;

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
    
    if (snap.phase === 'idle' || snap.phase === 'aiming' || snap.phase === 'casting') {
      this.actionButton.textContent = 'Cast';
    } else {
      this.actionButton.textContent = 'Reel';
    }

    switch (snap.phase) {
      case 'aiming':
        this.phaseIndicator.innerHTML = this.gaugeMarkup(snap.gaugeValue, snap.sweetSpot, snap.sweetSpotWidth);
        break;
      case 'waiting':
        this.phaseIndicator.innerHTML = `<div class="phase-label">Waiting for a bite&hellip;</div><div class="progress-track"><div class="progress-fill" style="width:${snap.waitProgress * 100}%"></div></div>`;
        break;
      case 'bite':
        this.phaseIndicator.innerHTML = `<div class="phase-label bite">BITE! Tap now!</div><div class="progress-track"><div class="progress-fill bite" style="width:${100 - snap.biteProgress * 100}%"></div></div>`;
        break;
      case 'missed':
        this.phaseIndicator.innerHTML = `<div class="phase-label missed">It got away&hellip;</div>`;
        break;
      default:
        this.phaseIndicator.innerHTML = '';
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
    this.openModal = this.openModal === id ? null : id;
    if (this.openModal === 'market') this.marketSystem.onMarketOpened();
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
    this.modalHost.classList.remove('hidden');
    if (this.openModal === 'shop') this.renderShop();
    else if (this.openModal === 'market') this.renderMarket();
    else if (this.openModal === 'craft') this.renderCraft();
    else if (this.openModal === 'collection') this.renderCollection();
    else if (this.openModal === 'settings') this.renderSettings();
  }

  private renderShop(): void {
    const state = this.economy.snapshot;
    const baitRows = BAIT_CATALOG.map((bait) => {
      const owned = state.baitInventory[bait.id] ?? 0;
      const equipped = state.equippedBaitId === bait.id;
      return `
        <li class="row">
          ${rowIcon(bait.id, bait.name, icon(ICON.bait, bait.name))}
          <div class="row-body">
            <strong>${bait.name}</strong>
            <span class="row-meta">${bait.free ? 'always available' : `${bait.costPerTen}🪙 / 10`} &middot; have ${bait.free ? '&infin;' : owned}</span>
          </div>
          <div class="row-actions">
            <button class="btn-small" data-action="equip-bait" data-id="${bait.id}" ${equipped ? 'disabled' : ''}>${equipped ? 'Equipped' : 'Equip'}</button>
            ${bait.free ? '' : `<button class="btn-small" data-action="buy-bait" data-id="${bait.id}">Buy 10</button>`}
          </div>
        </li>`;
    }).join('');

    const botRows = FISHBOT_CATALOG.map((bot) => {
      const owned = state.fishbots[bot.id]?.owned;
      return `
        <li class="row">
          ${rowIcon(bot.id, bot.name)}
          <div class="row-body">
            <strong>${bot.name}</strong>
            <span class="row-meta">${bot.cost}🪙 &middot; ${bot.baseIntervalSeconds}s cycle</span>
          </div>
          <div class="row-actions">
            <button class="btn-small" data-action="buy-fishbot" data-id="${bot.id}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : 'Buy'}</button>
          </div>
        </li>`;
    }).join('');

    const hopperCount = state.fishbotHopper.length;

    this.modalHost.innerHTML = this.modalShell(
      'Shop',
      `
        <h4 class="modal-subhead">Bait</h4>
        <ul class="modal-list">${baitRows}</ul>
        <h4 class="modal-subhead">Fishbots</h4>
        <ul class="modal-list">${botRows}</ul>
        <p class="modal-note">Hopper: ${hopperCount}/10 <button class="btn-small" data-action="claim-hopper" ${hopperCount === 0 ? 'disabled' : ''}>Claim</button></p>
      `,
    );
    this.bindModalActions();
  }

  private renderMarket(): void {
    const state = this.economy.snapshot;
    const bonesTotal = 3;
    const bones = this.marketSystem.patienceBones;
    const bonesMarkup = Array.from({ length: bonesTotal }, (_, i) =>
      `<span class="bone-icon ${i < bones ? '' : 'bone-spent'}">${icon(ICON.bone, 'patience bone', 'bone-img')}</span>`,
    ).join('');

    const rows = state.basket.map((item, index) => {
      if (item.isTrash) {
        return `<li class="row">${rowIcon(item.catchId, catchName(item.catchId))}<div class="row-body"><strong>${catchName(item.catchId)}</strong><span class="row-meta">trash — recycle at the Crafting Bench instead</span></div></li>`;
      }
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
            <button class="btn-small" data-action="sell" data-method="haggle" data-index="${index}">Haggle</button>
            <button class="btn-small" data-action="sell" data-method="desperate" data-index="${index}">Desperate</button>
          </div>
        </li>`;
    }).join('');

    this.modalHost.innerHTML = this.modalShell(
      "Monger Barnaby's Market",
      `
        <div class="market-header">
          <img class="barnaby-portrait" src="/images/barnaby-portrait.png" alt="Monger Barnaby" />
          <div class="bones-row" title="Patience bones">${bonesMarkup}</div>
          <button id="btn-debug-coins" class="btn-small" style="margin-left: auto;">+500 Coins (Debug)</button>
        </div>
        <ul class="modal-list">${rows || '<li class="row modal-empty">Basket is empty. Go catch something!</li>'}</ul>
      `,
    );
    this.bindModalActions();
  }

  private renderCraft(): void {
    const state = this.economy.snapshot;
    const materialEntries = Object.entries(state.materials).filter(([, amount]) => amount > 0);
    const materialsLine = materialEntries.length
      ? materialEntries.map(([id, amount]) => {
          const sprite = spriteFor(id);
          return `<span class="material-chip">${sprite ? icon(sprite, id, 'inline-icon') : ''}${amount} ${id}</span>`;
        }).join('')
      : '<span class="modal-note">No materials yet — recycle trash below.</span>';

    const upgradeRows = UPGRADE_CATALOG.map((upgrade) => {
      const tier = state.upgrades[upgrade.id] ?? 0;
      const maxed = tier >= upgrade.maxTier;
      const cost = upgrade.costPerTier[Math.min(tier, upgrade.maxTier - 1)];
      const costLabel = Object.entries(cost.materials)
        .map(([m, a]) => `${a} ${m}`)
        .join(', ');
      return `
        <li class="row">
          ${rowIcon(upgrade.id, upgrade.name, icon(ICON.hammer, upgrade.name))}
          <div class="row-body">
            <strong>${upgrade.name}</strong> <span class="tier-badge">${tier}/${upgrade.maxTier}</span>
            <span class="row-meta">${upgrade.description}</span>
            <span class="row-meta">${maxed ? 'Maxed' : `${cost.coins}🪙${costLabel ? `, ${costLabel}` : ''}`}</span>
          </div>
          <div class="row-actions">
            <button class="btn-small" data-action="buy-upgrade" data-id="${upgrade.id}" ${maxed ? 'disabled' : ''}>${maxed ? 'Maxed' : 'Craft'}</button>
          </div>
        </li>`;
    }).join('');

    const trashCount = state.basket.filter((item) => item.isTrash).length;

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
              <span class="row-meta">Cost: 2 rubber, 1 fabric</span>
            </div>
            <div class="row-actions">
              <button class="btn-small" data-action="craft-ducky" ${((state.materials.rubber ?? 0) < 2 || (state.materials.fabric ?? 0) < 1) ? 'disabled' : ''}>Craft</button>
              <button class="btn-small" data-action="use-ducky" ${(state.luckyDuckyCount ?? 0) === 0 ? 'disabled' : ''}>Use</button>
            </div>
          </li>
        </ul>
        
        <div class="craft-materials-row">
          <strong>Materials stash:</strong>
          <div class="materials-chips-list">${materialsLine}</div>
        </div>
        <p class="modal-note">Trash in basket: ${trashCount} 
          <button class="btn-small" data-action="recycle-all" ${trashCount === 0 ? 'disabled' : ''}>Recycle All</button>
          <button class="btn-small" id="btn-debug-garbage" style="margin-left: 8px;">+5 Trash (Debug)</button>
        </p>
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

  private modalShell(title: string, body: string): string {
    return `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
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

        if (action === 'close') this.toggleModal(this.openModal);
        else if (action === 'equip-bait') this.craftingSystem.equipBait(id);
        else if (action === 'buy-bait') this.craftingSystem.purchaseBait(id);
        else if (action === 'buy-fishbot') this.craftingSystem.purchaseFishbot(id);
        else if (action === 'claim-hopper') this.fishbotSystem.claimHopper();
        else if (action === 'sell' && method) this.marketSystem.sell(index, method);
        else if (action === 'buy-upgrade') this.craftingSystem.purchaseUpgrade(id as UpgradeId);
        else if (action === 'recycle-all') this.craftingSystem.recycleAllTrash();
        else if (action === 'craft-ducky') this.craftingSystem.craftLuckyDucky();
        else if (action === 'use-ducky') this.craftingSystem.useLuckyDucky();

        this.renderHud();
        if (action !== 'close') this.renderModal();
      });
    });

    const debugCoins = this.modalHost.querySelector('#btn-debug-coins');
    debugCoins?.addEventListener('click', () => {
      this.economy.addCoins(500);
      this.events.emit('coinsChanged', {});
    });

    const debugGarbage = this.modalHost.querySelector('#btn-debug-garbage');
    debugGarbage?.addEventListener('click', () => {
      this.craftingSystem.addRandomGarbage(5);
    });
  }

  private el(selector: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }
}
