import { verifyTwitchJwt, type TwitchJwtPayload } from './verifyTwitchJwt';
import { getSave, putSave } from './d1Client';
import { getBroadcasterSaveScope } from './twitchConfig';
import { resolveSaveKey } from './saveKey';

export interface Env {
  TWITCH_EXTENSION_SECRET: string;
  TWITCH_CLIENT_ID: string;
  /** D1 binding — see [[d1_databases]] in wrangler.toml. */
  DB: D1Database;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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

    if (url.pathname === '/save' && (request.method === 'GET' || request.method === 'PUT')) {
      const auth = request.headers.get('Authorization') ?? '';
      const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
      if (!token) return json({ error: 'missing bearer token' }, 401);

      const payload = await verifyTwitchJwt(token, env.TWITCH_EXTENSION_SECRET);
      if (!payload) return json({ error: 'invalid token' }, 401);

      const requestedScope = await getBroadcasterSaveScope(payload.channel_id, env.TWITCH_CLIENT_ID, env.TWITCH_EXTENSION_SECRET);
      const { key, scopeUsed } = resolveSaveKey(payload, requestedScope);

      if (request.method === 'GET') {
        if (key === null) return json({ scopeUsed, save: null });
        try {
          const doc = await getSave(env, key);
          return json({ scopeUsed, save: doc });
        } catch (err) {
          console.error('[ebs] D1 read failed', err);
          return json({ error: 'save read failed' }, 502);
        }
      }

      let body: { state: unknown; updatedAt: number };
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid JSON body' }, 400);
      }
      if (body.state === undefined || typeof body.updatedAt !== 'number') {
        return json({ error: 'body must be { state, updatedAt }' }, 400);
      }

      if (key === null) return json({ scopeUsed, stale: false });

      try {
        // `stale` means a newer snapshot for this key is already stored, so this
        // write was intentionally dropped — not an error, but the client should
        // know its state lost rather than assume it landed.
        const stored = await putSave(env, key, body.state, body.updatedAt);
        return json({ scopeUsed, stale: !stored });
      } catch (err) {
        console.error('[ebs] D1 write failed', err);
        return json({ error: 'save write failed' }, 502);
      }
    }

    return json({ error: 'not found' }, 404);
  },
};
