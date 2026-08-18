import type { EventBus } from '../core/EventBus';
import type { Economy } from '../game/Economy';
import type { GameEventMap } from '../game/events';
import type { GameSaveStateV1 } from '../game/SaveState';

/**
 * Mirrors the local save to the EBS so a viewer keeps one account across channels.
 *
 * localStorage stays authoritative during a session; this only pulls once at
 * authorization and pushes on a coarse timer. That split is deliberate — the game
 * autosaves every 5s, and mirroring that to the network would be ~17k writes/day
 * for a single continuously-playing viewer, against a 100k rows/day D1 free tier.
 * At this cadence a player costs a couple of hundred writes a day instead.
 *
 * Every failure path is a no-op rather than an error: outside a real extension
 * iframe (standalone dev, Playwright) no token ever arrives, and a viewer whose
 * save the server declines to hold (anonymous sessions — see resolveSaveKey in
 * the EBS) simply keeps playing against localStorage alone.
 */
const PUSH_INTERVAL_SECONDS = 60;

interface RemoteSave {
  scopeUsed: 'global' | 'channel' | 'anonymous';
  save: { state: GameSaveStateV1; updatedAt: number } | null;
}

export class CloudSaveSystem {
  private token: string | null = null;
  private pulled = false;
  /** Set once the server tells us this viewer isn't storable; stops all further traffic. */
  private disabled = false;
  private timer = 0;
  private lastPushedAt = 0;
  private inFlight = false;

  constructor(
    private readonly economy: Economy,
    private readonly events: EventBus<GameEventMap>,
    private readonly baseUrl: string | undefined = import.meta.env.VITE_EBS_BASE_URL,
  ) {
    this.events.on('twitchAuthorized', ({ token }) => {
      this.token = token;
      if (!this.pulled) {
        this.pulled = true;
        void this.pull();
      }
    });
    window.addEventListener('pagehide', this.onPageHide);
  }

  private readonly onPageHide = (): void => {
    // keepalive lets the request outlive the page; sendBeacon can't carry the
    // Authorization header the EBS requires, so it isn't an option here.
    void this.push(true);
  };

  private get active(): boolean {
    return !!this.baseUrl && !!this.token && !this.disabled;
  }

  /** Call every frame. */
  update(delta: number): void {
    if (!this.active) return;
    this.timer += delta;
    if (this.timer < PUSH_INTERVAL_SECONDS) return;
    this.timer = 0;
    void this.push(false);
  }

  /**
   * Pulls the server save and keeps whichever side is newer. Divergence is real —
   * the same viewer can play offline in one browser and online in another — and
   * this resolves it as last-write-wins on `lastActiveAtMs`. That silently drops
   * the losing branch, which is the cheap answer rather than the correct one; a
   * true merge would need per-field timestamps the save format doesn't carry.
   */
  private async pull(): Promise<void> {
    if (!this.active) return;
    try {
      const res = await fetch(`${this.baseUrl}/save`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!res.ok) return;
      const body = (await res.json()) as RemoteSave;

      if (body.scopeUsed === 'anonymous') {
        this.disabled = true;
        return;
      }
      if (!body.save) {
        // Nothing stored yet — seed the server from local so the next device has something.
        await this.push(false);
        return;
      }

      const local = this.economy.snapshot.lastActiveAtMs ?? 0;
      if (body.save.updatedAt > local) {
        this.economy.adoptState(body.save.state);
        this.events.emit('cloudSaveAdopted', {});
        this.lastPushedAt = body.save.updatedAt;
      } else {
        await this.push(false);
      }
    } catch (err) {
      console.error('[CloudSaveSystem] Save pull failed; continuing on local save.', err);
    }
  }

  private async push(keepalive: boolean): Promise<void> {
    if (!this.active) return;
    const updatedAt = this.economy.snapshot.lastActiveAtMs ?? Date.now();
    // Nothing has been persisted since the last push, so there is nothing new to send.
    if (updatedAt <= this.lastPushedAt) return;
    if (this.inFlight && !keepalive) return;

    this.inFlight = true;
    try {
      const res = await fetch(`${this.baseUrl}/save`, {
        method: 'PUT',
        keepalive,
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: this.economy.snapshot, updatedAt }),
      });
      if (!res.ok) return;
      const body = (await res.json()) as { scopeUsed: RemoteSave['scopeUsed']; stale: boolean };
      if (body.scopeUsed === 'anonymous') {
        this.disabled = true;
        return;
      }
      // A stale rejection means another session already stored something newer;
      // don't advance the watermark, so the next push retries rather than assuming it landed.
      if (!body.stale) this.lastPushedAt = updatedAt;
    } catch (err) {
      console.error('[CloudSaveSystem] Save push failed; local save is unaffected.', err);
    } finally {
      this.inFlight = false;
    }
  }

  dispose(): void {
    window.removeEventListener('pagehide', this.onPageHide);
  }
}
