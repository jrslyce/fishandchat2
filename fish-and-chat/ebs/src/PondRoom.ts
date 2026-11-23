import { CLOTHING_CATALOG, type ClothingSlot } from '../../src/game/data';

interface Fisher {
  id: string;
  name: string;
  level: number;
  outfit: Record<string, string | null>;
}

interface Ticket { fisher: Fisher; expiresAt: number }

function cleanOutfit(value: unknown): Record<string, string | null> {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const outfit: Record<string, string | null> = {};
  for (const slot of ['hat', 'jacket', 'pants', 'shoes'] as ClothingSlot[]) {
    const id = raw[slot];
    outfit[slot] = typeof id === 'string' && CLOTHING_CATALOG.some((item) => item.slot === slot && item.id === id)
      ? id : null;
  }
  return outfit;
}

/** One hibernating WebSocket room per Twitch channel. Client animation is local. */
export class PondRoom {
  constructor(private readonly state: DurableObjectState) {}

  private fishers(): Fisher[] {
    const byId = new Map<string, Fisher>();
    for (const socket of this.state.getWebSockets()) {
      const fisher = socket.deserializeAttachment() as Fisher | null;
      if (fisher) byId.set(fisher.id, fisher);
    }
    return [...byId.values()].slice(0, 101);
  }

  private broadcast(message: object): void {
    const data = JSON.stringify(message);
    for (const socket of this.state.getWebSockets()) {
      try { socket.send(data); } catch { /* closed socket */ }
    }
  }

  private roster(): void { this.broadcast({ type: 'roster', fishers: this.fishers() }); }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/ticket' && request.method === 'POST') {
      const raw = await request.json() as Fisher;
      const fisher: Fisher = {
        id: String(raw.id).slice(0, 32),
        name: String(raw.name).slice(0, 32),
        level: Number.isFinite(raw.level) ? Math.max(1, Math.min(999, Math.floor(raw.level))) : 1,
        outfit: cleanOutfit(raw.outfit),
      };
      const ticket = crypto.randomUUID();
      await this.state.storage.put(`ticket:${ticket}`, { fisher, expiresAt: Date.now() + 30_000 } satisfies Ticket);
      if (!await this.state.storage.getAlarm()) await this.state.storage.setAlarm(Date.now() + 60_000);
      return Response.json({ ticket });
    }
    if (url.pathname === '/announce' && request.method === 'POST') {
      const body = await request.json() as { name: string; itemName: string };
      this.broadcast({ type: 'fashion', name: String(body.name).slice(0, 32), itemName: String(body.itemName).slice(0, 80) });
      return Response.json({ ok: true });
    }
    if (url.pathname !== '/ws' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Not found', { status: 404 });
    }
    const ticketId = url.searchParams.get('ticket') ?? '';
    const key = `ticket:${ticketId}`;
    const ticket = await this.state.storage.get<Ticket>(key);
    await this.state.storage.delete(key);
    if (!ticket || ticket.expiresAt < Date.now()) return new Response('Ticket expired', { status: 401 });
    for (const socket of this.state.getWebSockets()) {
      const fisher = socket.deserializeAttachment() as Fisher | null;
      if (fisher?.id === ticket.fisher.id) socket.close(1000, 'Reconnected');
    }
    if (this.fishers().length >= 101 && !this.fishers().some((fisher) => fisher.id === ticket.fisher.id)) {
      return new Response('Pond is full', { status: 429 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    server.serializeAttachment(ticket.fisher);
    this.roster();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || message.length > 1024) return;
    let data: { type?: string; level?: number; outfit?: Record<string, string | null> };
    try { data = JSON.parse(message); } catch { return; }
    if (data.type !== 'appearance') return;
    const previous = socket.deserializeAttachment() as Fisher | null;
    if (!previous) return;
    socket.serializeAttachment({
      ...previous,
      level: Number.isFinite(data.level) ? Math.max(1, Math.min(999, Math.floor(data.level!))) : previous.level,
      outfit: data.outfit ? cleanOutfit(data.outfit) : previous.outfit,
    });
    this.roster();
  }

  async webSocketClose(): Promise<void> { this.roster(); }
  async webSocketError(): Promise<void> { this.roster(); }

  async alarm(): Promise<void> {
    const tickets = await this.state.storage.list<Ticket>({ prefix: 'ticket:' });
    for (const [key, ticket] of tickets) {
      if (ticket.expiresAt <= Date.now()) await this.state.storage.delete(key);
    }
    if (tickets.size > 0) await this.state.storage.setAlarm(Date.now() + 60_000);
  }
}
