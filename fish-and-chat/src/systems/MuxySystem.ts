import { CANDY_BAR_PACKS, type CandyBarPackDefinition } from '../game/data';
import type { Economy } from '../game/Economy';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';
import type { CraftingSystem } from './CraftingSystem';

interface WalletSnapshot {
  wallets: Array<{ channel_id: string; balance: number }>;
  ownedPremiumItemIds: string[];
  activity?: Array<{ channel_id: string; delta: number; reason: string; created_at: string }>;
}

interface TwitchBitsProduct {
  sku: string;
  cost: { amount: string; type: string };
}

interface TwitchExtension {
  onAuthorized(callback: (auth: { token: string; channelId: string }) => void): void;
  features?: { isBitsEnabled?: boolean; onChanged?: (callback: () => void) => void };
  bits?: {
    getProducts(): Promise<TwitchBitsProduct[]>;
    useBits(sku: string): void;
    onTransactionComplete(callback: (transaction: {
      initiator: string; transactionID: string; transactionReceipt: string;
    }) => void): void;
  };
}

/** Twitch Bits exchange with a server-verified, channel-scoped Candy Bar ledger. */
export class MuxySystem {
  private token: string | null = null;
  private products = new Map<string, TwitchBitsProduct>();
  private walletReady = false;
  private registered = false;
  private readonly ebsBaseUrl: string;

  constructor(
    private readonly craftingSystem: CraftingSystem,
    private readonly economy: Economy,
    private readonly events: EventBus<GameEventMap>,
    ebsBaseUrl = import.meta.env.VITE_EBS_BASE_URL ?? '',
  ) { this.ebsBaseUrl = ebsBaseUrl.replace(/\/$/, ''); }

  get isConfigured(): boolean {
    const ext = (window as unknown as { Twitch?: { ext?: TwitchExtension } }).Twitch?.ext;
    return Boolean(this.isTwitchSession && this.walletReady && ext?.features?.isBitsEnabled && this.products.size > 0);
  }

  get isTwitchSession(): boolean {
    return Boolean((window as unknown as { Twitch?: { ext?: unknown } }).Twitch?.ext && window.self !== window.top);
  }

  get packs(): CandyBarPackDefinition[] { return CANDY_BAR_PACKS; }

  isPackAvailable(packId: string): boolean {
    return this.isConfigured && this.products.has(packId);
  }

  async init(initial?: { token: string; channelId: string }): Promise<void> {
    const ext = (window as unknown as { Twitch?: { ext?: TwitchExtension } }).Twitch?.ext;
    if (!ext || !this.isTwitchSession) return;
    // Never use client-owned balances for Twitch Candy purchases, including while the EBS is unavailable.
    this.economy.setServerCandyMode();
    this.craftingSystem.useServerCandy((id) => { void this.redeemPremium(id); });
    if (initial?.token) {
      this.token = initial.token;
      void this.refreshWallet();
      void this.loadProducts(ext);
    }
    ext.onAuthorized((auth) => {
      this.token = auth.token;
      void this.refreshWallet();
      void this.loadProducts(ext);
    });
    ext.features?.onChanged?.(() => { void this.loadProducts(ext); });
    if (!this.registered && ext.bits) {
      this.registered = true;
      ext.bits.onTransactionComplete((transaction) => {
        if (transaction.initiator === 'current_user') void this.fulfill(transaction.transactionID);
      });
    }
  }

  private async request(path: string, body?: object): Promise<unknown> {
    if (!this.token || !this.ebsBaseUrl) throw new Error('Candy Bar service is unavailable');
    const response = await fetch(`${this.ebsBaseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error('Candy Bar service could not complete the request');
    return result;
  }

  private sync(snapshot: WalletSnapshot): void {
    if (!Array.isArray(snapshot.wallets) || !Array.isArray(snapshot.ownedPremiumItemIds)) throw new Error('Invalid wallet response');
    this.economy.applyServerWallet(snapshot);
    this.walletReady = true;
    this.events.emit('candyBarsChanged', {});
  }

  private async refreshWallet(): Promise<void> {
    try { this.sync(await this.request('/wallet') as WalletSnapshot); }
    catch (error) { this.walletReady = false; console.error('[CandyBars] Wallet load failed', error); }
  }

  private async loadProducts(ext: TwitchExtension): Promise<void> {
    this.products.clear();
    if (!ext.features?.isBitsEnabled || !ext.bits || !this.ebsBaseUrl) return;
    try {
      for (const product of await ext.bits.getProducts()) {
        const pack = CANDY_BAR_PACKS.find((entry) => entry.id === product.sku);
        if (pack && product.cost.type === 'bits' && Number(product.cost.amount) === pack.bitsCost) {
          this.products.set(product.sku, product);
        }
      }
    } catch (error) { console.error('[CandyBars] Bits products unavailable', error); }
    this.events.emit('candyBarsChanged', {});
  }

  purchaseCandyPack(packId: string): void {
    const pack = CANDY_BAR_PACKS.find((entry) => entry.id === packId);
    if (!pack) return;
    if (!this.isTwitchSession) { this.craftingSystem.grantCandyBars(pack.candyBars); return; }
    if (!this.isConfigured || !this.products.has(packId)) {
      this.craftingSystem.notifyCandyPurchaseUnavailable();
      return;
    }
    (window as unknown as { Twitch: { ext: TwitchExtension } }).Twitch.ext.bits?.useBits(packId);
  }

  private async fulfill(transactionId: string): Promise<void> {
    try {
      const result = await this.request('/bits/fulfill', { transactionId }) as { outcome: string; wallet: WalletSnapshot };
      this.sync(result.wallet);
      if (result.outcome === 'credited') this.events.emit('toast', { message: 'Candy Bars added to this channel wallet!' });
    } catch (error) {
      console.error('[CandyBars] Fulfillment pending', error);
      this.events.emit('toast', { message: 'Candy Bars pending. Reopen the shop shortly.' });
    }
  }

  private async redeemPremium(itemId: string): Promise<void> {
    if (!this.walletReady) {
      this.events.emit('toast', { message: 'Your Candy wallet is still loading.' });
      return;
    }
    try {
      const result = await this.request('/premium/redeem', { itemId }) as { outcome: string; wallet: WalletSnapshot };
      this.sync(result.wallet);
      this.events.emit('premiumItemPurchased', { id: itemId, ok: result.outcome === 'redeemed' });
      if (result.outcome === 'insufficient') this.events.emit('toast', { message: 'Not enough Candy Bars in this channel wallet.' });
      if (result.outcome === 'redeemed') this.events.emit('toast', { message: 'Fashion unlocked for your fisher!' });
    } catch (error) {
      console.error('[CandyBars] Redemption failed', error);
      this.events.emit('toast', { message: 'Candy redemption is unavailable. No bars were spent.' });
    }
  }
}
