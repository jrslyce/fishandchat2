import { CANDY_BAR_PACKS, type CandyBarPackDefinition } from '../game/data';
import type { CraftingSystem } from './CraftingSystem';

/**
 * Bits → Candy Bars purchase integration via the dev.muxy.io extension kit.
 *
 * NOTE: the exact Muxy SDK global name and callback shape below are our best guess pending
 * your extension ID/secret — verify against Muxy's console/docs once the extension exists
 * and adjust `loadSdk`/`registerProducts`/the purchase callback accordingly. Everything else
 * in the economy (candy bar balance, spending) does not depend on these details.
 *
 * Trust model: the SDK's purchase-complete callback is trusted directly, matching this
 * game's client-only economy elsewhere (coins, materials). There is no backend receipt
 * verification, so this is spoofable via devtools — acceptable for now, revisit if candy
 * bars ever back something with real-money-adjacent value.
 */
export class MuxySystem {
  private sdkReady = false;

  constructor(
    private readonly craftingSystem: CraftingSystem,
    private readonly extensionId: string | undefined = import.meta.env.VITE_MUXY_EXTENSION_ID,
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.extensionId);
  }

  get packs(): CandyBarPackDefinition[] {
    return CANDY_BAR_PACKS;
  }

  async init(): Promise<void> {
    if (!this.isConfigured) return; // no extension ID yet — purchaseCandyPack() falls back to a debug grant
    try {
      await this.loadSdk();
      this.sdkReady = true;
    } catch (err) {
      console.error('[MuxySystem] Failed to load Muxy SDK; candy bar purchases will use the debug fallback.', err);
    }
  }

  /** Kicks off a real bits transaction, or (unconfigured/local dev) grants candy bars directly for testing. */
  purchaseCandyPack(packId: string): void {
    const pack = CANDY_BAR_PACKS.find((p) => p.id === packId);
    if (!pack) return;

    if (!this.sdkReady) {
      this.craftingSystem.grantCandyBars(pack.candyBars);
      return;
    }

    const muxy = (window as unknown as { Muxy?: MuxyGlobal }).Muxy;
    muxy?.purchaseBits?.(pack.bitsCost, (result) => {
      if (result?.success) this.craftingSystem.grantCandyBars(pack.candyBars);
    });
  }

  private loadSdk(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as unknown as { Muxy?: MuxyGlobal }).Muxy) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.muxy.io/extension/sdk.js'; // TODO: confirm actual CDN path with Muxy docs
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Muxy SDK script failed to load'));
      document.head.appendChild(script);
    });
  }
}

interface MuxyGlobal {
  purchaseBits?: (bitsCost: number, callback: (result: { success: boolean }) => void) => void;
}
