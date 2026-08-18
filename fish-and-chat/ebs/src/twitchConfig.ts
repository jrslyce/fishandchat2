/**
 * Reads the broadcaster's save-scope choice from Twitch's Extension Configuration Service —
 * the broadcaster sets it client-side in config.html via `twitch.ext.configuration.set('broadcaster', ...)`,
 * and this reads it back server-side so /save can decide the save key without trusting
 * anything the viewer's own client claims.
 *
 * NOTE: the Configuration Service backend endpoint/JWT-claim shape below is our best-effort
 * reading of Twitch's docs, unverified against a real deployed extension (same caveat as
 * MuxySystem.ts on the frontend) — confirm via the Developer Rig or a Hosted Test once the
 * extension's config.html is live, and adjust the JWT claims/endpoint if Twitch rejects it.
 */
export type SaveScope = 'global' | 'channel';

interface CachedScope {
  scope: SaveScope;
  expiresAtMs: number;
}

const CACHE_TTL_MS = 60_000;
const scopeCache = new Map<string, CachedScope>();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Signs a short-lived "external" role JWT for backend calls to Twitch's Configuration Service. */
async function signConfigServiceJwt(extensionSecretBase64: string): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const claims = { exp: nowSeconds + 60, role: 'external' };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const claimsB64 = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  const keyBytes = Uint8Array.from(atob(extensionSecretBase64.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Defaults to 'channel' (the safe, always-available scope) if config is unset or unreachable. */
export async function getBroadcasterSaveScope(
  channelId: string,
  extensionClientId: string,
  extensionSecretBase64: string,
): Promise<SaveScope> {
  const cached = scopeCache.get(channelId);
  if (cached && cached.expiresAtMs > Date.now()) return cached.scope;

  try {
    const jwt = await signConfigServiceJwt(extensionSecretBase64);
    const url = `https://api.twitch.tv/extensions/${extensionClientId}/configurations/segments?segment=broadcaster&channel_id=${encodeURIComponent(channelId)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${jwt}`, 'Client-Id': extensionClientId },
    });
    if (!res.ok) return 'channel';

    const data = (await res.json()) as { data?: Array<{ content?: string }> };
    const content = data.data?.[0]?.content;
    const parsed = content ? (JSON.parse(content) as { saveScope?: string }) : null;
    const scope: SaveScope = parsed?.saveScope === 'global' ? 'global' : 'channel';

    scopeCache.set(channelId, { scope, expiresAtMs: Date.now() + CACHE_TTL_MS });
    return scope;
  } catch (err) {
    console.error('[ebs] Configuration Service lookup failed; defaulting to channel scope.', err);
    return 'channel';
  }
}
