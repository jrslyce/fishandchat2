import { CANDY_BAR_PACKS, type CandyBarPackDefinition } from '../game/data';
import type { CraftingSystem } from './CraftingSystem';

/**
 * Bits → Candy Bars purchase integration via the Muxy extension kit.
 *
 * The Muxy SDK is vendored locally at `public/muxy.js` and loaded via a static `<script>` tag
 * in index.html (not fetched from a CDN at runtime) — Twitch's extension CSP blocks third-party
 * CDN script origins, so self-hosting from `'self'` is required, mirroring the working pattern
 * from another Twitch extension in this account.
 *
 * NOTE: the exact Muxy SDK global name and callback shape below are our best guess pending
 * your extension ID/secret — verify against Muxy's console/docs once the extension exists
 * and adjust the purchase callback accordingly. Everything else in the economy (candy bar
 * balance, spending) does not depend on these details.
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
    if (!(window as unknown as { Muxy?: MuxyGlobal }).Muxy) {
      console.error('[MuxySystem] Muxy SDK not present; candy bar purchases will use the debug fallback.');
      return;
    }
    this.sdkReady = true;
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
}

interface MuxyGlobal {
  purchaseBits?: (bitsCost: number, callback: (result: { success: boolean }) => void) => void;
}
