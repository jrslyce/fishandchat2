import { SaveManager } from '../core/SaveManager';
import { createDefaultSaveState, type GameSaveStateV1 } from '../game/SaveState';

const CLOUD_KEY = 'fishAndChatSave';
const OWNER_KEY = 'fish-and-chat-local-owner';

interface TwitchExtension {
  onAuthorized(callback: (auth: { clientId: string; channelId: string; token: string; helixToken?: string }) => void): void;
  actions?: { requestIdShare?: () => void };
  viewer?: { id?: string | null };
}

export interface ProgressSession {
  initialState?: GameSaveStateV1;
  channelId: string;
  channelName: string;
  channelAvatarUrl: string | null;
  localSaveKey?: string;
  onSave?: (state: GameSaveStateV1) => void;
  getAuthToken?: () => string;
  initialIdentity?: { clientId: string; helixToken?: string; viewerId: string | null };
  requiresIdentity?: boolean;
}

function parseState(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function validSave(value: unknown): value is GameSaveStateV1 {
  const state = value as Partial<GameSaveStateV1> | null;
  return Boolean(state && typeof state === 'object' && typeof state.level === 'number' &&
    typeof state.coins === 'number' && typeof state.candyBars === 'number' &&
    Array.isArray(state.basket) && state.upgrades && state.equippedClothing);
}

async function channelProfile(channelId: string, clientId: string, helixToken?: string): Promise<{ name: string; avatar: string | null }> {
  if (!helixToken) return { name: `Channel ${channelId}`, avatar: null };
  try {
    const response = await fetch(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(channelId)}`, {
      headers: { 'Client-ID': clientId, Authorization: `Extension ${helixToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Helix ${response.status}`);
    const data = await response.json() as { data?: Array<{ display_name?: string; profile_image_url?: string }> };
    const user = data.data?.[0];
    return { name: user?.display_name || `Channel ${channelId}`, avatar: user?.profile_image_url || null };
  } catch {
    return { name: `Channel ${channelId}`, avatar: null };
  }
}

async function muxyState(auth: { clientId: string; token: string }, method: 'GET' | 'POST', body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.muxy.io/v1/e/extension_viewer_state', {
    method,
    headers: {
      Authorization: `${auth.clientId} ${auth.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Muxy state ${response.status}`);
  return parseState(await response.text());
}

/** Loads a verified viewer's cross-channel save before Game builds its systems. */
export async function initializeMuxyProgress(): Promise<ProgressSession> {
  const twitch = (window as unknown as { Twitch?: { ext?: TwitchExtension } }).Twitch?.ext;
  // The Twitch helper is also present in local development, but it never
  // authorizes a top-level page. Start local play without its auth timeout.
  if (window.self === window.top && !twitch?.viewer?.id) {
    return { channelId: 'local', channelName: 'Local game', channelAvatarUrl: null };
  }
  if (!twitch) return window.self !== window.top
    ? { channelId: 'unknown', channelName: 'Twitch channel', channelAvatarUrl: null, requiresIdentity: true }
    : { channelId: 'local', channelName: 'Local game', channelAvatarUrl: null };

  const auth = await new Promise<{ clientId: string; channelId: string; token: string; helixToken?: string; viewerId: string | null } | null>((resolve) => {
    let requested = false;
    let firstAuth: { clientId: string; channelId: string; token: string; helixToken?: string } | null = null;
    const timeout = window.setTimeout(() => resolve(firstAuth ? { ...firstAuth, viewerId: null } : null), 12_000);
    twitch.onAuthorized((next) => {
      firstAuth = next;
      const viewerId = twitch.viewer?.id ?? null;
      if (viewerId) {
        window.clearTimeout(timeout);
        resolve({ ...next, viewerId });
      } else if (!requested) {
        requested = true;
        twitch.actions?.requestIdShare?.();
      }
    });
  });
  if (!auth) return window.self !== window.top
    ? { channelId: 'unknown', channelName: 'Twitch channel', channelAvatarUrl: null, requiresIdentity: true }
    : { channelId: 'local', channelName: 'Local game', channelAvatarUrl: null };

  const profile = await channelProfile(auth.channelId, auth.clientId, auth.helixToken);
  let latestToken = auth.token;
  twitch.onAuthorized((next) => { if (next.channelId === auth.channelId) latestToken = next.token; });
  const fallback: ProgressSession = {
    channelId: auth.channelId, channelName: profile.name, channelAvatarUrl: profile.avatar,
    localSaveKey: `fish-and-chat-save-v1:${auth.viewerId ?? `anonymous:${auth.channelId}`}`,
    getAuthToken: () => latestToken,
    initialIdentity: { clientId: auth.clientId, helixToken: auth.helixToken, viewerId: auth.viewerId },
  };
  if (!auth.viewerId) return { ...fallback, requiresIdentity: true };
  const owner = auth.viewerId;
  const localOwner = window.localStorage.getItem(OWNER_KEY);
  const hasScopedSave = window.localStorage.getItem(fallback.localSaveKey!) !== null;
  const scopedLocal = new SaveManager(createDefaultSaveState, undefined, undefined, fallback.localSaveKey).load();
  const local = hasScopedSave ? scopedLocal :
    localOwner && localOwner !== owner ? createDefaultSaveState() : new SaveManager(createDefaultSaveState).load();
  fallback.initialState = local;

  try {
    const cloud = await muxyState(auth, 'GET');
    const envelope = parseState(cloud[CLOUD_KEY]);
    const state = validSave(envelope.state) ? envelope.state : local;
    window.localStorage.setItem(OWNER_KEY, owner);

    let pending: GameSaveStateV1 | null = null;
    let timer: number | null = null;
    let writing = false;
    const flush = async (): Promise<void> => {
      if (writing || !pending) return;
      writing = true;
      while (pending) {
        const current = pending;
        pending = null;
        try {
          await muxyState({ ...auth, token: latestToken }, 'POST', {
            ...cloud,
            [CLOUD_KEY]: { version: 1, savedAt: Date.now(), state: current },
          });
        } catch (error) {
          console.error('[MuxyProgressStore] Cloud save failed; retaining the local save.', error);
          // A later local mutation will retry; avoid an unbounded retry loop.
          break;
        }
      }
      writing = false;
    };
    return {
      ...fallback,
      initialState: state,
      onSave: (next) => {
        pending = structuredClone(next);
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(() => { timer = null; void flush(); }, 3000);
      },
    };
  } catch (error) {
    console.error('[MuxyProgressStore] Cloud load failed; using the local save.', error);
    return fallback;
  }
}
