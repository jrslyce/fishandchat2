import { verifyTwitchJwt } from './verifyTwitchJwt';
import { fetchDisplayName } from './helixClient';
import { authorizedSession, fulfillBits, redeemPremium, walletSnapshot } from './candyLedger';
import { PondRoom } from './PondRoom';
import { PREMIUM_CATALOG } from '../../src/game/data';
import { handleBitsEventSub } from './eventsub';

export { PondRoom };

export interface Env {
  TWITCH_EXTENSION_SECRET: string;
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
  TWITCH_EVENTSUB_SECRET: string;
  DB: D1Database;
  PONDS: DurableObjectNamespace;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/health') {
      return json({ ok: true });
    }

    if (url.pathname === '/eventsub/bits' && request.method === 'POST') {
      try { return await handleBitsEventSub(request, env); }
      catch (error) {
        console.error('[ebs] EventSub processing failed', error);
        return new Response('Temporary failure', { status: 503 });
      }
    }

    if (url.pathname === '/wallet' && request.method === 'GET') {
      const session = await authorizedSession(request, env);
      return session ? json(await walletSnapshot(env, session)) : json({ error: 'identity sharing required' }, 401);
    }

    if (url.pathname === '/pond/ticket' && request.method === 'POST') {
      const session = await authorizedSession(request, env);
      if (!session) return json({ error: 'identity sharing required' }, 401);
      const body = await request.json().catch(() => null) as { level?: number; outfit?: Record<string, string | null> } | null;
      const name = env.TWITCH_CLIENT_SECRET
        ? await fetchDisplayName(session.user_id, env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET).catch(() => null)
        : null;
      const room = env.PONDS.get(env.PONDS.idFromName(session.channel_id));
      const response = await room.fetch('https://pond.internal/ticket', {
        method: 'POST',
        body: JSON.stringify({ id: session.user_id, name: name ?? 'Angler', level: body?.level, outfit: body?.outfit }),
      });
      return json(await response.json(), response.status);
    }

    if (url.pathname === '/pond/ws') {
      const channelId = url.searchParams.get('channelId') ?? '';
      if (!/^\d+$/.test(channelId)) return new Response('Invalid channel', { status: 400 });
      const room = env.PONDS.get(env.PONDS.idFromName(channelId));
      return room.fetch(new Request(`https://pond.internal/ws?ticket=${encodeURIComponent(url.searchParams.get('ticket') ?? '')}`, request));
    }

    if (url.pathname === '/bits/fulfill' && request.method === 'POST') {
      const session = await authorizedSession(request, env);
      if (!session) return json({ error: 'identity sharing required' }, 401);
      const body = await request.json().catch(() => null) as { transactionId?: unknown } | null;
      if (typeof body?.transactionId !== 'string') return json({ error: 'transactionId required' }, 400);
      try {
        const outcome = await fulfillBits(env, session, body.transactionId);
        return json({ outcome, wallet: await walletSnapshot(env, session) }, outcome === 'invalid' ? 400 : 200);
      } catch (error) {
        console.error('[ebs] Bits fulfillment failed', error);
        return json({ error: 'fulfillment temporarily unavailable' }, 503);
      }
    }

    if (url.pathname === '/premium/redeem' && request.method === 'POST') {
      const session = await authorizedSession(request, env);
      if (!session) return json({ error: 'identity sharing required' }, 401);
      const body = await request.json().catch(() => null) as { itemId?: unknown } | null;
      if (typeof body?.itemId !== 'string') return json({ error: 'itemId required' }, 400);
      try {
        const outcome = await redeemPremium(env, session, body.itemId);
        if (outcome === 'redeemed') {
          const item = PREMIUM_CATALOG.find((entry) => entry.id === body.itemId);
          if (item && !['bottomless-tackle-box', 'master-salvage-magnet'].includes(item.id)) {
            const name = await fetchDisplayName(session.user_id, env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET)
              .catch(() => null);
            const room = env.PONDS.get(env.PONDS.idFromName(session.channel_id));
            try {
              await room.fetch('https://pond.internal/announce', {
                method: 'POST', body: JSON.stringify({ name: name ?? 'An angler', itemName: item.name }),
              });
            } catch (error) {
              console.error('[ebs] Fashion announcement failed after redemption', error);
            }
          }
        }
        return json({ outcome, wallet: await walletSnapshot(env, session) }, outcome === 'invalid' ? 400 : 200);
      } catch (error) {
        console.error('[ebs] Premium redemption failed', error);
        return json({ error: 'redemption temporarily unavailable' }, 503);
      }
    }

    if (url.pathname === '/profile') {
      const auth = request.headers.get('Authorization') ?? '';
      const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
      if (!token) return json({ error: 'missing bearer token' }, 401);

      const payload = await verifyTwitchJwt(token, env.TWITCH_EXTENSION_SECRET);
      if (!payload) return json({ error: 'invalid token' }, 401);

      if (!payload.user_id) {
        return json({ shared: false, displayName: null });
      }

      try {
        const displayName = await fetchDisplayName(payload.user_id, env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET);
        return json({ shared: true, displayName });
      } catch (err) {
        console.error('[ebs] Helix lookup failed', err);
        return json({ shared: true, displayName: null }, 502);
      }
    }

    return json({ error: 'not found' }, 404);
  },
};
