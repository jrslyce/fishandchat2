import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';

/**
 * Twitch Extension identity handshake: loads the Extension Helper script, grabs the signed
 * JWT via `onAuthorized`, prompts the viewer to share their Twitch ID, and asks the EBS to
 * resolve a display name once shared. Emits `twitchIdentityResolved` on the shared event bus.
 *
 * Mirrors MuxySystem's shape: graceful no-op outside a real Twitch extension iframe (standalone
 * dev, Playwright tests) — `window.Twitch` simply won't exist there, and this system never throws.
 */
export class TwitchAuthSystem {
  private token: string | null = null;
  private requestedIdShare = false;

  constructor(
    private readonly events: EventBus<GameEventMap>,
    private readonly ebsBaseUrl: string | undefined = import.meta.env.VITE_EBS_BASE_URL,
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.ebsBaseUrl);
  }

  async init(): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await this.loadHelperScript();
    } catch (err) {
      console.error('[TwitchAuthSystem] Failed to load Twitch Extension Helper; identity features disabled.', err);
      return;
    }

    const twitch = (window as unknown as { Twitch?: TwitchGlobal }).Twitch;
    twitch?.ext?.onAuthorized((auth) => {
      this.token = auth.token;
      if (!this.requestedIdShare) {
        this.requestedIdShare = true;
        twitch.ext?.actions?.requestIdShare?.();
      }
      void this.fetchProfile();
    });
  }

  private async fetchProfile(): Promise<void> {
    if (!this.token || !this.ebsBaseUrl) return;
    try {
      const res = await fetch(`${this.ebsBaseUrl}/profile`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { shared: boolean; displayName: string | null };
      if (data.shared && data.displayName) {
        this.events.emit('twitchIdentityResolved', { displayName: data.displayName });
      }
    } catch (err) {
      console.error('[TwitchAuthSystem] Profile lookup failed; continuing without a Twitch display name.', err);
    }
  }

  private loadHelperScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as unknown as { Twitch?: TwitchGlobal }).Twitch?.ext) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://extension-files.twitch.tv/helper/v1/twitch-ext.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Twitch Extension Helper script failed to load'));
      document.head.appendChild(script);
    });
  }
}

interface TwitchAuthCallback {
  (auth: { token: string; userId?: string; channelId: string; clientId: string }): void;
}

interface TwitchGlobal {
  ext?: {
    onAuthorized: (callback: TwitchAuthCallback) => void;
    actions?: { requestIdShare?: () => void };
  };
}
