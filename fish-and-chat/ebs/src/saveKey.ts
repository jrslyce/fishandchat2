import type { SaveScope } from './twitchConfig';
import type { TwitchJwtPayload } from './verifyTwitchJwt';

/** What a request actually resolved to, which is not always what the broadcaster configured. */
export type ResolvedScope = SaveScope | 'anonymous';

/**
 * Picks the row key for this viewer.
 *
 * Two things make a viewer globally addressable. The obvious one is `user_id`, present once
 * they've granted ID share (see requestIdShare() in the frontend's TwitchAuthSystem). The less
 * obvious one is a `U`-prefixed opaque ID: per Twitch's JWT schema those are "stable references
 * to a Twitch account across sessions and channels", so any logged-in viewer can carry one
 * account between channels without ever seeing the share prompt.
 *
 * `A`-prefixed opaque IDs are transient anonymous sessions that Twitch documents as things you
 * "should never associate with persistent data" — they change between sessions, so a row keyed
 * on one is written once and never read again. Those get no server storage at all rather than
 * accumulating landfill; localStorage still carries them within a browser.
 */
export function resolveSaveKey(
  payload: TwitchJwtPayload,
  scope: SaveScope,
): { key: string | null; scopeUsed: ResolvedScope } {
  if (scope === 'global') {
    if (payload.user_id) return { key: `global:${payload.user_id}`, scopeUsed: 'global' };
    if (payload.opaque_user_id?.startsWith('U')) {
      return { key: `global:${payload.opaque_user_id}`, scopeUsed: 'global' };
    }
  }

  const viewerId = payload.user_id ?? payload.opaque_user_id;
  if (!viewerId || viewerId.startsWith('A')) return { key: null, scopeUsed: 'anonymous' };

  return { key: `channel:${payload.channel_id}:${viewerId}`, scopeUsed: 'channel' };
}
