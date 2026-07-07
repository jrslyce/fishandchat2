import { verifyTwitchJwt } from './verifyTwitchJwt';
import { fetchDisplayName } from './helixClient';

export interface Env {
  TWITCH_EXTENSION_SECRET: string;
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
