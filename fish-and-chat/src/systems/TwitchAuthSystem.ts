import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';

/**
 * Twitch Extension identity handshake: grabs the signed JWT + helixToken via `onAuthorized`,
 * prompts the viewer to share their Twitch ID, and once shared resolves their display name by
 * calling Helix directly from the client (`Authorization: Extension <helixToken>`) — no backend
 * needed, since `https://api.twitch.tv` is already in Twitch's default extension CSP allowlist.
 * Emits `twitchIdentityResolved` on the shared event bus.
 *
 * The Extension Helper script (`twitch-ext.min.js`) must be a static `<script>` tag in
 * index.html, not injected dynamically — Twitch's platform checks for it early and flags
 * "Extension Helper Library Not Loaded" if it isn't present in time.
 *
 * Mirrors MuxySystem's shape: graceful no-op outside a real Twitch extension iframe (standalone
 * dev, Playwright tests) — `window.Twitch.ext` simply won't call back there, and this system
 * never throws.
 */
export class TwitchAuthSystem {
  private helixToken: string | null = null;
  private clientId: string | null = null;
  private requestedIdShare = false;

  constructor(private readonly events: EventBus<GameEventMap>) {}

  async init(): Promise<void> {
    const twitch = (window as unknown as { Twitch?: TwitchGlobal }).Twitch;
    if (!twitch?.ext) {
      console.error('[TwitchAuthSystem] Twitch Extension Helper not present; identity features disabled.');
      return;
    }

    twitch.ext.onAuthorized((auth) => {
      this.helixToken = auth.helixToken ?? null;
      this.clientId = auth.clientId;
      // onAuthorized re-fires periodically as the JWT is rotated, so this is the
      // token's only reliable source — CloudSaveSystem takes each new one.
      this.events.emit('twitchAuthorized', { token: auth.token });
      if (!this.requestedIdShare) {
        this.requestedIdShare = true;
        twitch.ext?.actions?.requestIdShare?.();
      }
      void this.fetchProfile(twitch);
    });
  }

  private async fetchProfile(twitch: TwitchGlobal): Promise<void> {
    const viewerId = twitch.ext?.viewer?.id;
    if (!viewerId || !this.helixToken || !this.clientId) return;
    try {
      const res = await fetch(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(viewerId)}`, {
        headers: {
          'Client-ID': this.clientId,
          Authorization: `Extension ${this.helixToken}`,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { data: Array<{ display_name: string }> };
      const displayName = data.data[0]?.display_name;
      if (displayName) {
        this.events.emit('twitchIdentityResolved', { displayName });
      }
    } catch (err) {
      console.error('[TwitchAuthSystem] Profile lookup failed; continuing without a Twitch display name.', err);
    }
  }
}

interface TwitchAuthCallback {
  (auth: { token: string; userId?: string; channelId: string; clientId: string; helixToken?: string }): void;
}

interface TwitchGlobal {
  ext?: {
    onAuthorized: (callback: TwitchAuthCallback) => void;
    actions?: { requestIdShare?: () => void };
    viewer?: { id?: string };
  };
}
