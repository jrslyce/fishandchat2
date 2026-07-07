/**
 * Twitch signs the Extension Helper JWT with HS256 using the extension's secret
 * (base64-encoded, from the dev console). Verified here with Web Crypto so the
 * Worker needs no JWT library dependency.
 */
export interface TwitchJwtPayload {
  channel_id: string;
  opaque_user_id: string;
  user_id?: string;
  exp: number;
  [key: string]: unknown;
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToText(input: string): string {
  return new TextDecoder().decode(base64UrlToBytes(input));
}

/** `secretBase64` is the raw base64 extension secret from the Twitch dev console (not base64url). */
export async function verifyTwitchJwt(token: string, secretBase64: string): Promise<TwitchJwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(base64UrlToText(headerB64));
  } catch {
    return null;
  }
  if (header.alg !== 'HS256') return null;

  const keyBytes = base64UrlToBytes(secretBase64.replace(/-/g, '+').replace(/_/g, '/'));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);

  const signatureBytes = base64UrlToBytes(signatureB64);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!valid) return null;

  let payload: TwitchJwtPayload;
  try {
    payload = JSON.parse(base64UrlToText(payloadB64));
  } catch {
    return null;
  }

  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;

  return payload;
}
