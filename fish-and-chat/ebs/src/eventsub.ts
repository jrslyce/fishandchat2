import type { Env } from './index';
import { creditVerifiedTransaction, type TwitchTransaction } from './candyLedger';

function hexBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index++) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

/** Twitch's signed EventSub webhook makes Bits fulfillment survive a closed viewer panel. */
export async function handleBitsEventSub(request: Request, env: Env): Promise<Response> {
  if (!env.TWITCH_EVENTSUB_SECRET) return new Response('EventSub not configured', { status: 503 });
  const id = request.headers.get('Twitch-Eventsub-Message-Id') ?? '';
  const timestamp = request.headers.get('Twitch-Eventsub-Message-Timestamp') ?? '';
  const signature = request.headers.get('Twitch-Eventsub-Message-Signature') ?? '';
  const when = Date.parse(timestamp);
  if (!id || !Number.isFinite(when) || Math.abs(Date.now() - when) > 10 * 60_000) {
    return new Response('Stale EventSub message', { status: 403 });
  }
  const bytes = signature.startsWith('sha256=') ? hexBytes(signature.slice(7)) : null;
  if (!bytes) return new Response('Invalid EventSub signature', { status: 403 });
  const raw = await request.text();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TWITCH_EVENTSUB_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`${id}${timestamp}${raw}`));
  if (!verified) return new Response('Invalid EventSub signature', { status: 403 });

  let body: { challenge?: string; subscription?: { type?: string; condition?: { extension_client_id?: string } }; event?: {
    id?: string; extension_client_id?: string; broadcaster_user_id?: string; user_id?: string;
    product?: { sku?: string; bits?: number };
  } };
  try { body = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (body.subscription?.type !== 'extension.bits_transaction.create' ||
      body.subscription.condition?.extension_client_id !== env.TWITCH_CLIENT_ID) {
    return new Response('Wrong subscription', { status: 403 });
  }
  const type = request.headers.get('Twitch-Eventsub-Message-Type');
  if (type === 'webhook_callback_verification' && typeof body.challenge === 'string') {
    return new Response(body.challenge, { headers: { 'Content-Type': 'text/plain' } });
  }
  if (type === 'revocation') return new Response(null, { status: 204 });
  if (type !== 'notification' || !body.event) return new Response('Unexpected message', { status: 400 });
  const event = body.event;
  if (!event.id || !event.user_id || !event.broadcaster_user_id || !event.product?.sku ||
      event.extension_client_id !== env.TWITCH_CLIENT_ID) return new Response('Incomplete event', { status: 400 });
  const transaction: TwitchTransaction = {
    id: event.id,
    user_id: event.user_id,
    broadcaster_id: event.broadcaster_user_id,
    product_type: 'BITS_IN_EXTENSION',
    product_data: {
      sku: event.product.sku,
      domain: `twitch.ext.${env.TWITCH_CLIENT_ID}`,
      cost: { amount: event.product.bits ?? 0, type: 'bits' },
    },
  };
  const outcome = await creditVerifiedTransaction(env, transaction);
  if (outcome === 'invalid') return new Response('Unknown product', { status: 400 });
  return new Response(null, { status: 204 });
}
