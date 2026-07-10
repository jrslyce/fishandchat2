import type { Rarity } from '../game/data';

/** Base fight value per rarity — the fish's average toughness before the per-catch roll. */
const FIGHT_BASE: Record<Rarity, number> = {
  trash: 0,
  common: 8,
  uncommon: 16,
  rare: 28,
  epic: 45,
  legendary: 70,
};

const BASE_WINDOW_MS = 1200;
const MIN_WINDOW_MS = 900;
const MAX_WINDOW_MS = 8000;
const MS_PER_SKILL_MARGIN = 40;

const MIN_SUCCESS_CHANCE = 0.05;
const MAX_SUCCESS_CHANCE = 0.97;

/**
 * Rolls how hard the hooked fish fights, +/-25% of its rarity's base by default. Charmer
 * archetype points shrink that spread (`varianceReduction`, 0..~0.2) so fish trend calmer
 * instead of occasionally rolling near the top of their range.
 */
export function rollFightValue(rarity: Rarity, varianceReduction = 0): number {
  const base = FIGHT_BASE[rarity];
  const variance = Math.max(0.05, 0.25 - varianceReduction);
  return base * (1 - variance + Math.random() * variance * 2);
}

/**
 * How long the reel window stays open: longer when skill comfortably exceeds fight, shrinking
 * toward the floor when an undergeared player hooks a tough fish — but never so short it's
 * unplayable, and never unbounded even for a maxed-out player.
 */
export function computeReactionWindowMs(skill: number, fight: number, flatBonusMs: number): number {
  const margin = skill - fight;
  const raw = BASE_WINDOW_MS + margin * MS_PER_SKILL_MARGIN + flatBonusMs;
  return Math.max(MIN_WINDOW_MS, Math.min(MAX_WINDOW_MS, raw));
}

/**
 * Odds of landing the fish on a manual reel attempt (a tap). Clamped well short of 0 and 100%
 * — even a heavily-geared player can lose a legendary, and even a fresh player has some shot
 * at a common.
 */
export function computeSuccessChance(skill: number, fight: number, trapperBonus: number): number {
  const base = skill / (skill + Math.max(1, fight));
  return Math.max(MIN_SUCCESS_CHANCE, Math.min(MAX_SUCCESS_CHANCE, base + trapperBonus));
}

const HAZARD_BASE_PER_SECOND = 0.02;
const HAZARD_RAMP_SECONDS = 5;
/** Beyond this many hooked seconds, the fish escapes unconditionally — a bad-luck backstop. */
export const HAZARD_BACKSTOP_SECONDS = 12;

/**
 * Passive escape risk for a hooked fish nobody has reeled in yet: starts low and climbs every
 * second, faster for fish that outmatch the player's skill. There is no auto-resolve for
 * regular play anymore (see GameState.ts) — this is the only way an un-tapped bite ever ends,
 * short of the hard backstop above.
 *
 * `windowMs` is `computeReactionWindowMs`'s output — rod/line/lure/bait/Patience-archetype
 * investment all raise it, and here it slows the ramp (more real time before things get
 * dangerous) rather than defining a hard cutoff like it used to — the same gear/archetype
 * bonuses from last session still matter, just applied to this mechanic instead.
 */
export function computeEscapeHazardPerSecond(skill: number, fight: number, elapsedSeconds: number, windowMs: number): number {
  const fightRatio = fight / Math.max(1, skill + fight);
  const base = HAZARD_BASE_PER_SECOND * (0.5 + fightRatio * 1.5);
  const rampSeconds = HAZARD_RAMP_SECONDS * (windowMs / BASE_WINDOW_MS);
  const ramp = 1 + elapsedSeconds / rampSeconds;
  return Math.min(1, base * ramp);
}
