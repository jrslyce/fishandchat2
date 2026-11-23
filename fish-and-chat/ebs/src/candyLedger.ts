import { CANDY_BAR_PACKS, PREMIUM_CATALOG } from '../../src/game/data';
import type { Env } from './index';
import { verifyTwitchJwt, type TwitchJwtPayload } from './verifyTwitchJwt';

type Session = TwitchJwtPayload & { user_id: string };

export async function authorizedSession(request: Request, env: Env): Promise<Session | null> {
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const payload = await verifyTwitchJwt(token, env.TWITCH_EXTENSION_SECRET).catch(() => null);
  if (!payload?.user_id || !payload.channel_id) return null;
  return payload as Session;
}

export async function walletSnapshot(env: Env, session: Session): Promise<object> {
  const wallets = await env.DB.prepare('SELECT channel_id, balance FROM candy_wallets WHERE user_id = ?')
    .bind(session.user_id).all<{ channel_id: string; balance: number }>();
  const entitlements = await env.DB.prepare('SELECT item_id FROM premium_entitlements WHERE user_id = ?')
    .bind(session.user_id).all<{ item_id: string }>();
  const activity = await env.DB.prepare('SELECT channel_id, delta, reason, created_at FROM candy_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .bind(session.user_id).all<{ channel_id: string; delta: number; reason: string; created_at: string }>();
  return {
    channelId: session.channel_id,
    wallets: wallets.results,
    ownedPremiumItemIds: entitlements.results.map((row) => row.item_id),
    activity: activity.results,
  };
}

export interface TwitchTransaction {
  id: string;
  broadcaster_id: string;
  user_id: string;
  product_type: string;
  product_data: { sku: string; domain: string; cost: { amount: number | string; type: string } };
}

async function verifiedTransaction(id: string, env: Env): Promise<TwitchTransaction | null> {
  const params = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', body: params });
  if (!tokenResponse.ok) throw new Error(`Twitch token ${tokenResponse.status}`);
  const token = await tokenResponse.json() as { access_token: string };
  const url = new URL('https://api.twitch.tv/helix/extensions/transactions');
  url.searchParams.set('extension_id', env.TWITCH_CLIENT_ID);
  url.searchParams.set('id', id);
  const response = await fetch(url, {
    headers: { 'Client-Id': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${token.access_token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Twitch transaction ${response.status}`);
  const result = await response.json() as { data: TwitchTransaction[] };
  return result.data.find((entry) => entry.id === id) ?? null;
}

/** Credits one channel wallet from a Twitch-confirmed transaction, at most once globally. */
export async function fulfillBits(env: Env, session: Session, transactionId: string): Promise<'credited' | 'duplicate' | 'invalid'> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(transactionId)) return 'invalid';
  const transaction = await verifiedTransaction(transactionId, env);
  if (!transaction || transaction.user_id !== session.user_id || transaction.broadcaster_id !== session.channel_id) return 'invalid';
  return creditVerifiedTransaction(env, transaction);
}

/** Shared by the Helix reconciliation path and signed EventSub notifications. */
export async function creditVerifiedTransaction(env: Env, transaction: TwitchTransaction): Promise<'credited' | 'duplicate' | 'invalid'> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(transaction.id)) return 'invalid';
  const pack = CANDY_BAR_PACKS.find((item) => item.id === transaction?.product_data?.sku);
  if (!pack || transaction.product_type !== 'BITS_IN_EXTENSION' ||
      transaction.product_data.domain !== `twitch.ext.${env.TWITCH_CLIENT_ID}` ||
      transaction.product_data.cost.type !== 'bits' || Number(transaction.product_data.cost.amount) !== pack.bitsCost) return 'invalid';
  const existing = await env.DB.prepare('SELECT entry_id FROM candy_ledger WHERE entry_id = ?')
    .bind(`bits:${transaction.id}`).first();
  if (existing) return 'duplicate';

  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO candy_ledger (entry_id, user_id, channel_id, delta, reason) VALUES (?, ?, ?, ?, ?)')
        .bind(`bits:${transaction.id}`, transaction.user_id, transaction.broadcaster_id, pack.candyBars, `bits:${pack.id}`),
      env.DB.prepare('INSERT OR IGNORE INTO candy_wallets (user_id, channel_id, balance) VALUES (?, ?, 0)')
        .bind(transaction.user_id, transaction.broadcaster_id),
      env.DB.prepare('UPDATE candy_wallets SET balance = balance + ? WHERE user_id = ? AND channel_id = ?')
        .bind(pack.candyBars, transaction.user_id, transaction.broadcaster_id),
    ]);
    return 'credited';
  } catch (error) {
    const duplicate = await env.DB.prepare('SELECT entry_id FROM candy_ledger WHERE entry_id = ?')
      .bind(`bits:${transaction.id}`).first();
    if (duplicate) return 'duplicate';
    throw error;
  }
}

/** A permanent premium item is owned account-wide, while the debit is channel-specific. */
export async function redeemPremium(env: Env, session: Session, itemId: string): Promise<'redeemed' | 'owned' | 'insufficient' | 'invalid'> {
  const item = PREMIUM_CATALOG.find((entry) => entry.id === itemId);
  if (!item || ['rainbow-totem', 'mega-chum-bucket', 'whale-call-horn'].includes(itemId)) return 'invalid';
  const owned = await env.DB.prepare('SELECT item_id FROM premium_entitlements WHERE user_id = ? AND item_id = ?')
    .bind(session.user_id, itemId).first();
  if (owned) return 'owned';
  const wallet = await env.DB.prepare('SELECT balance FROM candy_wallets WHERE user_id = ? AND channel_id = ?')
    .bind(session.user_id, session.channel_id).first<{ balance: number }>();
  if ((wallet?.balance ?? 0) < item.costCandyBars) return 'insufficient';
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO premium_entitlements (user_id, item_id) VALUES (?, ?)').bind(session.user_id, itemId),
      env.DB.prepare('INSERT INTO candy_ledger (entry_id, user_id, channel_id, delta, reason) VALUES (?, ?, ?, ?, ?)')
        .bind(`premium:${session.user_id}:${itemId}`, session.user_id, session.channel_id, -item.costCandyBars, `premium:${itemId}`),
      env.DB.prepare('UPDATE candy_wallets SET balance = balance - ? WHERE user_id = ? AND channel_id = ?')
        .bind(item.costCandyBars, session.user_id, session.channel_id),
    ]);
    return 'redeemed';
  } catch (error) {
    const after = await env.DB.prepare('SELECT item_id FROM premium_entitlements WHERE user_id = ? AND item_id = ?')
      .bind(session.user_id, itemId).first();
    if (after) return 'owned';
    const latest = await env.DB.prepare('SELECT balance FROM candy_wallets WHERE user_id = ? AND channel_id = ?')
      .bind(session.user_id, session.channel_id).first<{ balance: number }>();
    if ((latest?.balance ?? 0) < item.costCandyBars) return 'insufficient';
    throw error;
  }
}
