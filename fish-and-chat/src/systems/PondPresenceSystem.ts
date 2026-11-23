import type { Economy } from '../game/Economy';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';
import { CLOTHING_CATALOG } from '../game/data';

interface Fisher {
  id: string;
  name: string;
  level: number;
  outfit: Record<string, string | null>;
}

/** Small shared-pond overview. The server sends presence; casting motion is visual and local. */
export class PondPresenceSystem {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private channelId: string | null = null;
  private fishers: Fisher[] = [];
  private stopped = false;
  private retryTimer: number | null = null;
  private readonly baseUrl = (import.meta.env.VITE_EBS_BASE_URL ?? '').replace(/\/$/, '');
  private readonly button = document.createElement('button');
  private readonly panel = document.createElement('section');
  private readonly status = document.createElement('p');
  private readonly map = document.createElement('div');
  private readonly roster = document.createElement('div');
  private readonly announcement = document.createElement('div');

  constructor(private readonly economy: Economy, private readonly events: EventBus<GameEventMap>,
    initial?: { token: string; channelId: string }) {
    const debugCount = import.meta.env.DEV ? Math.min(101, Math.max(0, Math.floor(Number(new URLSearchParams(location.search).get('debugPond')) || 0))) : 0;
    if (!this.baseUrl && !debugCount) return;
    const twitch = (window as unknown as { Twitch?: { ext?: {
      onAuthorized(callback: (auth: { token: string; channelId: string }) => void): void;
    } } }).Twitch?.ext;
    if ((!twitch || window.self === window.top) && !debugCount) return;

    this.button.id = 'pond-presence-button';
    this.button.type = 'button';
    this.button.textContent = '🎣 Pond · 1';
    this.button.setAttribute('aria-label', 'Open shared pond');
    this.button.addEventListener('click', () => { this.panel.hidden = !this.panel.hidden; });

    this.panel.id = 'pond-presence-panel';
    this.panel.hidden = true;
    const header = document.createElement('div');
    header.className = 'pond-presence-header';
    const title = document.createElement('strong');
    title.textContent = 'The Shared Pond';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close shared pond');
    close.addEventListener('click', () => { this.panel.hidden = true; });
    header.append(title, close);
    this.status.className = 'pond-presence-status';
    this.status.textContent = 'Connecting fishers…';
    this.map.className = 'pond-presence-map';
    this.roster.className = 'pond-presence-roster';
    this.announcement.className = 'pond-fashion-announcement';
    this.announcement.hidden = true;
    this.panel.append(header, this.status, this.map, this.roster);
    document.querySelector('#app')?.append(this.button, this.panel, this.announcement);

    if (debugCount) {
      this.fishers = Array.from({ length: debugCount }, (_, index) => ({
        id: `debug-${index + 1}`, name: `Debug fisher ${index + 1}`, level: 1 + index % 40, outfit: {},
      }));
      this.renderRoster();
      return;
    }

    if (initial?.token) {
      this.token = initial.token;
      this.channelId = initial.channelId;
      void this.connect();
    }

    twitch!.onAuthorized((auth) => {
      this.token = auth.token;
      if (this.channelId !== auth.channelId || !this.socket) {
        this.channelId = auth.channelId;
        void this.connect();
      }
    });
    this.events.on('clothingEquipped', () => this.sendAppearance());
    this.events.on('baseToneChanged', () => this.sendAppearance());
    this.events.on('xpGained', ({ leveledUp }) => { if (leveledUp) this.sendAppearance(); });
  }

  private async connect(): Promise<void> {
    if (this.stopped || !this.token || !this.channelId || this.socket?.readyState === WebSocket.OPEN) return;
    try {
      const response = await fetch(`${this.baseUrl}/pond/ticket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: this.economy.snapshot.level, outfit: this.economy.snapshot.equippedClothing }),
      });
      if (!response.ok) throw new Error(`Pond ticket ${response.status}`);
      const { ticket } = await response.json() as { ticket: string };
      const url = new URL(this.baseUrl);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = '/pond/ws';
      url.searchParams.set('channelId', this.channelId);
      url.searchParams.set('ticket', ticket);
      const socket = new WebSocket(url);
      this.socket?.close();
      this.socket = socket;
      socket.onmessage = (event) => this.handleMessage(event.data);
      socket.onclose = () => {
        if (this.socket !== socket || this.stopped) return;
        this.status.textContent = 'Reconnecting to the pond…';
        this.retryTimer = window.setTimeout(() => { this.retryTimer = null; void this.connect(); }, 5000);
      };
    } catch (error) {
      console.error('[PondPresence] Connection failed', error);
      this.status.textContent = 'Pond presence unavailable';
      this.retryTimer = window.setTimeout(() => { this.retryTimer = null; void this.connect(); }, 10000);
    }
  }

  private handleMessage(data: string): void {
    let message: { type?: string; fishers?: Fisher[]; name?: string; itemName?: string };
    try { message = JSON.parse(data); } catch { return; }
    if (message.type === 'roster' && Array.isArray(message.fishers)) {
      this.fishers = message.fishers.slice(0, 101);
      this.renderRoster();
    }
    if (message.type === 'fashion' && message.name && message.itemName) {
      this.announcement.textContent = `✨ ${message.name} unlocked ${message.itemName}!`;
      this.announcement.hidden = false;
      window.setTimeout(() => { this.announcement.hidden = true; }, 5500);
    }
  }

  private renderRoster(): void {
    const count = this.fishers.length;
    this.button.textContent = `🎣 Pond · ${count}`;
    this.status.textContent = `${count} ${count === 1 ? 'fisher' : 'fishers'} here now`;
    this.map.replaceChildren();
    this.roster.replaceChildren();
    const pond = document.createElement('div');
    pond.className = 'pond-presence-water';
    pond.textContent = 'THE POND';
    this.map.append(pond);
    this.fishers.forEach((fisher, index) => {
      // Five concentric bank paths keep 101 tiny fishers legible in a panel.
      const ring = Math.min(4, Math.floor(index / 20));
      const slot = index - ring * 20;
      const ringCount = ring === 4 ? count - 80 : Math.min(20, count - ring * 20);
      const angle = (slot / ringCount) * Math.PI * 2 - Math.PI / 2 + ring * 0.07;
      const radius = 23 + ring * 5.5;
      const fashionId = Object.values(fisher.outfit ?? {}).find((id) => typeof id === 'string') ?? '';
      const fashionName = CLOTHING_CATALOG.find((item) => item.id === fashionId)?.name;
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'pond-fisher-marker';
      marker.textContent = '🎣';
      marker.title = `${fisher.name} · Level ${fisher.level}${fashionName ? ` · ${fashionName}` : ''}`;
      marker.style.left = `${50 + Math.cos(angle) * radius}%`;
      marker.style.top = `${50 + Math.sin(angle) * radius}%`;
      if (fashionId) {
        const hue = [...fashionId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
        marker.style.backgroundColor = `hsl(${hue} 75% 87%)`;
      }
      marker.style.animationDelay = `${(index * 0.37) % 3}s`;
      marker.addEventListener('click', () => { this.status.textContent = `${fisher.name} · Level ${fisher.level}${fashionName ? ` · ${fashionName}` : ''}`; });
      this.map.append(marker);
      const row = document.createElement('div');
      row.className = 'pond-roster-row';
      row.textContent = `${fisher.name} · Lv ${fisher.level}`;
      this.roster.append(row);
    });
  }

  private sendAppearance(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'appearance', level: this.economy.snapshot.level, outfit: this.economy.snapshot.equippedClothing }));
  }

  dispose(): void {
    this.stopped = true;
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    this.socket?.close();
    this.button.remove();
    this.panel.remove();
    this.announcement.remove();
  }
}
