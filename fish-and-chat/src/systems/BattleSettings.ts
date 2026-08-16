import { DEFAULT_BATTLE_CONFIG, type BattleConfig, type BattleInputMode, type BattleTrigger } from './MathBattle';
import type { Rarity } from '../game/data';

/**
 * Resolves the broadcaster's battle settings.
 *
 * The broadcaster config already travels as one JSON blob on the Twitch
 * `broadcaster` configuration segment (see config.ts, which owns `saveScope` in
 * the same object). This reads a `battle` key out of that blob, so turning
 * battles on is a change to the existing settings page rather than a new
 * transport — the config view just needs to write the key.
 *
 * A URL override sits on top for development, matching the `?props=voxel`
 * convention the diorama already uses. It is read once at load.
 */

interface TwitchConfigGlobal {
  ext?: {
    configuration?: {
      broadcaster?: { content: string };
    };
  };
}

const TRIGGERS: BattleTrigger[] = ['off', 'always', 'rarity', 'bait', 'chance'];
const RARITIES: Rarity[] = ['trash', 'common', 'uncommon', 'rare', 'epic', 'legendary'];

function parseBroadcasterBattleConfig(): Partial<BattleConfig> {
  const twitch = (window as unknown as { Twitch?: TwitchConfigGlobal }).Twitch;
  const content = twitch?.ext?.configuration?.broadcaster?.content;
  if (!content) return {};
  try {
    const parsed = JSON.parse(content) as { battle?: Partial<BattleConfig> };
    return parsed.battle ?? {};
  } catch {
    // A malformed segment must not take the game down with it — the broadcaster
    // simply gets the defaults, which is battles off.
    console.warn('[BattleSettings] broadcaster config is not valid JSON; using defaults');
    return {};
  }
}

function parseUrlOverrides(): Partial<BattleConfig> {
  const params = new URLSearchParams(window.location.search);
  const overrides: Partial<BattleConfig> = {};

  const trigger = params.get('battle');
  if (trigger && (TRIGGERS as string[]).includes(trigger)) {
    overrides.trigger = trigger as BattleTrigger;
  }

  const minRarity = params.get('battleRarity');
  if (minRarity && (RARITIES as string[]).includes(minRarity)) {
    overrides.minRarity = minRarity as Rarity;
  }

  const input = params.get('battleInput');
  if (input === 'typed' || input === 'choice') {
    overrides.inputMode = input as BattleInputMode;
  }

  const timer = params.get('battleTimer');
  if (timer === 'off') overrides.timerEnabled = false;
  if (timer === 'on') overrides.timerEnabled = true;

  const chance = params.get('battleChance');
  if (chance !== null) {
    const value = Number(chance);
    if (Number.isFinite(value)) overrides.chancePct = Math.max(0, Math.min(100, value));
  }

  return overrides;
}

let resolved: BattleConfig | null = null;

/** The active battle config: defaults, then the broadcaster's settings, then any URL override. */
export function battleConfig(): BattleConfig {
  if (!resolved) {
    resolved = {
      ...DEFAULT_BATTLE_CONFIG,
      ...parseBroadcasterBattleConfig(),
      ...parseUrlOverrides(),
    };
  }
  return resolved;
}

/** Re-reads the settings; call if the broadcaster changes them mid-session. */
export function refreshBattleConfig(): BattleConfig {
  resolved = null;
  return battleConfig();
}
