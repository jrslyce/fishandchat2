import { RARITY_ORDER, type Rarity } from '../game/data';

/**
 * The fish battle: a hooked fish becomes a short encounter where correct
 * arithmetic lands hits and mistakes cost line tension.
 *
 * Everything here is pure except BattleSession's own state — no THREE, no DOM,
 * no Economy — so the trigger rules and problem generation can be reasoned
 * about (and tested) without standing up a game.
 */

export type BattleTrigger = 'off' | 'always' | 'rarity' | 'bait' | 'chance';
export type BattleInputMode = 'choice' | 'typed';

export interface BattleConfig {
  trigger: BattleTrigger;
  /** For 'rarity': the lowest rarity that triggers a battle. */
  minRarity: Rarity;
  /** For 'chance': percentage of eligible catches, 0-100. */
  chancePct: number;
  /** For 'bait': the bait ids that opt the player in. */
  baitIds: string[];
  inputMode: BattleInputMode;
  /** Off makes problems untimed — arithmetic against a clock is a real anxiety trigger for some players. */
  timerEnabled: boolean;
}

/**
 * Off by default, deliberately. Maths in a cozy idle fishing game is a genre
 * clash for part of the audience, so this is opt-in by the broadcaster rather
 * than something every channel inherits.
 */
export const DEFAULT_BATTLE_CONFIG: BattleConfig = {
  trigger: 'off',
  minRarity: 'rare',
  chancePct: 25,
  baitIds: [],
  inputMode: 'choice',
  timerEnabled: true,
};

export interface BattleContext {
  rarity: Rarity;
  baitId: string;
  /** True for fishbot catches and the magic-reeler upgrade. */
  automated: boolean;
}

/**
 * Whether this catch becomes a battle.
 *
 * Every trigger mode the broadcaster can pick resolves here, so they are one
 * code path rather than five — adding a mode means a case, not a new branch
 * threaded through the state machine.
 */
export function shouldBattle(context: BattleContext, config: BattleConfig): boolean {
  // Idle catches never battle. A fishbot reeling in while the viewer is away
  // has nobody to answer, so a battle would either block the idle loop forever
  // or silently eat the fish — and the idle loop is the whole point of buying
  // a fishbot in the first place.
  if (context.automated) return false;
  // Trash is never worth an encounter, whatever the mode.
  if (context.rarity === 'trash') return false;

  switch (config.trigger) {
    case 'off':
      return false;
    case 'always':
      return true;
    case 'rarity':
      return RARITY_ORDER.indexOf(context.rarity) >= RARITY_ORDER.indexOf(config.minRarity);
    case 'bait':
      return config.baitIds.includes(context.baitId);
    case 'chance':
      return Math.random() * 100 < config.chancePct;
  }
}

export type DifficultyBand = 'add' | 'mul' | 'multi';

/** Tougher fish ask harder questions — the difficulty curve rides the rarity curve that already exists. */
export function bandForRarity(rarity: Rarity): DifficultyBand {
  switch (rarity) {
    case 'trash':
    case 'common':
      return 'add';
    case 'uncommon':
    case 'rare':
      return 'mul';
    default:
      return 'multi';
  }
}

export interface MathProblem {
  text: string;
  answer: number;
  /** Four options for multiple choice, shuffled. Ignored in typed mode. */
  choices: number[];
}

function randInt(low: number, high: number): number {
  return low + Math.floor(Math.random() * (high - low + 1));
}

/**
 * Wrong answers are built from mistakes someone actually makes — off by ten,
 * off by one, a dropped carry. Random numbers would be eliminated on sight and
 * multiple choice would degrade into free damage.
 */
function buildChoices(answer: number, band: DifficultyBand): number[] {
  const candidates =
    band === 'add'
      ? [answer + 10, answer - 10, answer + 1, answer - 1, answer + 9]
      : [answer + 10, answer - 10, answer - 1, answer + 2, answer - 6, answer + 6];

  const seen = new Set<number>([answer]);
  const options = [answer];
  for (const candidate of candidates) {
    if (options.length >= 4) break;
    if (candidate > 0 && !seen.has(candidate)) {
      seen.add(candidate);
      options.push(candidate);
    }
  }

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

export function generateProblem(band: DifficultyBand): MathProblem {
  let text: string;
  let answer: number;

  if (band === 'add') {
    const a = randInt(12, 79);
    const b = randInt(11, 68);
    text = `${a} + ${b}`;
    answer = a + b;
  } else if (band === 'mul') {
    const a = randInt(6, 19);
    const b = randInt(4, 12);
    text = `${a} × ${b}`;
    answer = a * b;
  } else {
    const a = randInt(4, 12);
    const b = randInt(3, 9);
    const c = randInt(5, 40);
    text = `${a} × ${b} + ${c}`;
    answer = a * b + c;
  }

  return { text, answer, choices: buildChoices(answer, band) };
}

/** Correct answers needed to land the fish. Mirrors the rarity ladder FightSystem already uses. */
export function battleHitPoints(rarity: Rarity): number {
  switch (rarity) {
    case 'trash':
    case 'common':
      return 3;
    case 'uncommon':
      return 4;
    case 'rare':
      return 6;
    case 'epic':
      return 8;
    case 'legendary':
      return 9;
  }
}

/** Mistakes allowed before the line snaps. Deliberately shallow — a battle should be tense, not a war of attrition. */
export function battleTension(rarity: Rarity): number {
  return rarity === 'epic' || rarity === 'legendary' ? 3 : 4;
}

/** Seconds per problem, shrinking with rarity. Ignored when the broadcaster turns the timer off. */
export function secondsPerProblem(rarity: Rarity): number {
  switch (rarity) {
    case 'trash':
    case 'common':
      return 10;
    case 'uncommon':
    case 'rare':
      return 8;
    default:
      return 6;
  }
}

/** Answering inside this fraction of the clock counts as a clean hit. */
const FAST_ANSWER_FRACTION = 0.6;

export interface BattleAnswerOutcome {
  correct: boolean;
  /** True when the answer also beat the fast-answer threshold. */
  fast: boolean;
  damage: number;
  finished: 'won' | 'lost' | null;
}

export interface BattleSnapshot {
  fishName: string;
  rarity: Rarity;
  hp: number;
  hpMax: number;
  tension: number;
  tensionMax: number;
  problem: MathProblem;
  secondsLeft: number;
  secondsPerProblem: number;
  inputMode: BattleInputMode;
  timerEnabled: boolean;
  problemsAsked: number;
}

/**
 * One encounter's live state. Owns the clock so the state machine only has to
 * feed it delta and relay the player's answer.
 */
export class BattleSession {
  private hp: number;
  private tension: number;
  private problem: MathProblem;
  private secondsLeft: number;
  private asked = 1;
  private over: 'won' | 'lost' | null = null;

  readonly hpMax: number;
  readonly tensionMax: number;
  readonly perProblemSeconds: number;
  private readonly band: DifficultyBand;

  constructor(
    readonly rarity: Rarity,
    readonly fishName: string,
    private readonly config: BattleConfig,
  ) {
    this.hpMax = battleHitPoints(rarity);
    this.tensionMax = battleTension(rarity);
    this.perProblemSeconds = secondsPerProblem(rarity);
    this.band = bandForRarity(rarity);
    this.hp = this.hpMax;
    this.tension = this.tensionMax;
    this.problem = generateProblem(this.band);
    this.secondsLeft = this.perProblemSeconds;
  }

  snapshot(): BattleSnapshot {
    return {
      fishName: this.fishName,
      rarity: this.rarity,
      hp: this.hp,
      hpMax: this.hpMax,
      tension: this.tension,
      tensionMax: this.tensionMax,
      problem: this.problem,
      secondsLeft: this.secondsLeft,
      secondsPerProblem: this.perProblemSeconds,
      inputMode: this.config.inputMode,
      timerEnabled: this.config.timerEnabled,
      problemsAsked: this.asked,
    };
  }

  outcome(): 'won' | 'lost' | null {
    return this.over;
  }

  /** Advances the clock. Returns the timeout's outcome when one runs out, else null. */
  tick(delta: number): BattleAnswerOutcome | null {
    if (this.over || !this.config.timerEnabled) return null;
    this.secondsLeft -= delta;
    if (this.secondsLeft > 0) return null;
    this.secondsLeft = 0;
    return this.submit(null);
  }

  /**
   * Resolves an answer. `null` means the clock ran out, which costs tension
   * exactly as a wrong answer does.
   */
  submit(value: number | null): BattleAnswerOutcome {
    if (this.over) {
      return { correct: false, fast: false, damage: 0, finished: this.over };
    }

    const correct = value !== null && value === this.problem.answer;
    const fast =
      correct &&
      this.config.timerEnabled &&
      this.secondsLeft > this.perProblemSeconds * FAST_ANSWER_FRACTION;

    let damage = 0;
    if (correct) {
      // Typed answers can't be guessed from four options, so they hit harder —
      // the same setting doubles as the difficulty knob and its own reward.
      damage = 1 + (fast ? 1 : 0) + (this.config.inputMode === 'typed' ? 1 : 0);
      this.hp = Math.max(0, this.hp - damage);
    } else {
      this.tension = Math.max(0, this.tension - 1);
    }

    if (this.hp <= 0) this.over = 'won';
    else if (this.tension <= 0) this.over = 'lost';
    else this.nextProblem();

    return { correct, fast, damage, finished: this.over };
  }

  private nextProblem(): void {
    this.problem = generateProblem(this.band);
    this.secondsLeft = this.perProblemSeconds;
    this.asked += 1;
  }
}
