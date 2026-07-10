import {
  CastGauge,
  castPrecision,
  gaugeValue,
  precisionSkillBonus,
  randomSweetSpot,
} from '../systems/CastingSystem';
import { rollWaitSeconds } from '../systems/BiteSystem';
import {
  computeEscapeHazardPerSecond,
  computeReactionWindowMs,
  computeSuccessChance,
  rollFightValue,
  HAZARD_BACKSTOP_SECONDS,
} from '../systems/FightSystem';
import { resolveCatch } from '../systems/CatchResolver';
import { computeRarityWeights, rollRarity, type Rarity } from './data';
import type { Economy } from './Economy';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap, CatchResult } from './events';
import type { InputController } from '../core/InputController';

export type FishingPhase =
  | 'idle'
  | 'aiming'
  | 'casting'
  | 'waiting'
  | 'bite'
  | 'resolving'
  | 'celebrating'
  | 'missed';

export const CASTING_ANIM_SECONDS = 0.4;
const CELEBRATING_SECONDS = 2.5;
const MISSED_TOAST_SECONDS = 1.4;
/** Odds, on an otherwise-successful reel, that it turns out to be nothing after all. */
const BAIT_STOLEN_CHANCE = 0.05;
const NO_CATCH_CHANCE = 0.07;

export interface FishingSnapshot {
  phase: FishingPhase;
  gaugeValue: number;
  sweetSpot: number;
  sweetSpotWidth: number;
  waitProgress: number;
  biteProgress: number;
  lastCatch: CatchResult | null;
}

/**
 * Owns the IDLE -> AIMING -> CASTING -> WAITING -> BITE -> RESOLVING ->
 * CELEBRATING -> IDLE loop (plus MISSED). Consumes raw input edges directly
 * so every phase can react to the same single action intent; Game.ts is
 * responsible for calling `input.update()` once per frame after all systems
 * have read the edges.
 */
export class FishingStateMachine {
  private phase: FishingPhase = 'idle';
  private phaseElapsed = 0;
  private aimClock = 0;
  private gauge: CastGauge = randomSweetSpot();
  private lockedPrecision = 0;
  private lockedRolls: { L: number; T: number; S: number } | null = null;
  private waitDurationSeconds = 0;
  private lastCatch: CatchResult | null = null;
  private hookedRarity: Rarity | null = null;
  private fightValue = 0;
  private skillValueForBite = 0;
  private currentReactionWindowMs = 0;
  
  public debugPerfectCastMode = false;
  public autoFishingEnabled = false;

  constructor(
    private readonly economy: Economy,
    private readonly events: EventBus<GameEventMap>,
  ) {}

  getPhase(): FishingPhase {
    return this.phase;
  }

  /** Used by Game.ts's tap-anywhere-during-a-bite handler. No-ops outside the bite phase. */
  manualReelAttempt(): void {
    if (this.phase !== 'bite') return;
    this.attemptReel(false);
  }

  snapshot(): FishingSnapshot {
    return {
      phase: this.phase,
      gaugeValue: this.phase === 'aiming' ? gaugeValue(this.aimClock) : 0,
      sweetSpot: this.gauge.sweetSpot,
      sweetSpotWidth: this.gauge.sweetSpotWidth,
      waitProgress: this.phase === 'waiting' ? Math.min(1, this.phaseElapsed / this.waitDurationSeconds) : 0,
      biteProgress: this.phase === 'bite' ? Math.min(1, this.phaseElapsed / HAZARD_BACKSTOP_SECONDS) : 0,
      lastCatch: this.lastCatch,
    };
  }

  update(delta: number, input: InputController): void {
    this.phaseElapsed += delta;

    switch (this.phase) {
      case 'idle':
        if (input.justPressed()) this.tryStartCast();
        else if (this.autoFishingEnabled && !this.economy.basketFull() && this.phaseElapsed > 1.5) this.tryStartCast();
        break;
      case 'aiming':
        this.aimClock += delta;
        if (input.justPressed()) this.lockCast();
        else if (this.autoFishingEnabled && this.aimClock > 0.5) this.lockCast();
        break;
      case 'casting':
        if (this.phaseElapsed >= CASTING_ANIM_SECONDS) this.enterWaiting();
        break;
      case 'waiting':
        if (input.justPressed()) this.reelInEarly();
        else if (this.phaseElapsed >= this.waitDurationSeconds) this.enterBite();
        break;
      case 'bite': {
        const hasAutoReel = this.autoFishingEnabled || this.economy.hasUpgrade('magic-reeler');
        if (input.justPressed()) {
          this.attemptReel(false);
        } else if (hasAutoReel) {
          this.attemptReel(true);
        } else if (this.phaseElapsed >= HAZARD_BACKSTOP_SECONDS) {
          this.enterMissed('escaped');
        } else {
          const hazardPerSecond = computeEscapeHazardPerSecond(
            this.skillValueForBite,
            this.fightValue,
            this.phaseElapsed,
            this.currentReactionWindowMs,
          );
          const escapeChanceThisFrame = 1 - Math.pow(1 - hazardPerSecond, delta);
          if (Math.random() < escapeChanceThisFrame) this.enterMissed('escaped');
        }
        break;
      }
      case 'resolving':
        // Transient: resolveBiteSuccess() moves straight through to 'celebrating'
        // in the same tick, so this case should never be observed mid-frame.
        break;
      case 'celebrating':
        if (this.phaseElapsed >= CELEBRATING_SECONDS || input.justPressed()) this.enterIdle();
        break;
      case 'missed':
        if (this.phaseElapsed >= MISSED_TOAST_SECONDS) this.enterIdle();
        break;
    }
  }

  private tryStartCast(): void {
    if (this.economy.basketFull()) {
      this.events.emit('basketFull', {});
      this.events.emit('toast', { message: 'Basket is full — visit the market to sell some catches!' });
      return;
    }
    this.gauge = randomSweetSpot();
    this.aimClock = 0;
    this.setPhase('aiming');
  }

  private lockCast(): void {
    const value = this.debugPerfectCastMode ? this.gauge.sweetSpot : gaugeValue(this.aimClock);
    this.lockedPrecision = castPrecision(value, this.gauge);
    
    let L = 0, T = 0, S = 0;
    if (this.lockedPrecision > 0.95) {
      L = 7; T = 7; S = 7;
    } else if (this.lockedPrecision > 0) {
      L = Math.floor(Math.random() * 6) + 1;
      T = Math.floor(Math.random() * 6) + 1;
      S = Math.floor(Math.random() * 6) + 1;
    }
    this.lockedRolls = { L, T, S };
    
    this.events.emit('castLocked', { precision: this.lockedPrecision, rolls: this.lockedRolls });
    
    if (this.lockedRolls && (this.lockedRolls.L === 1 || this.lockedRolls.L === 7) && Math.random() < 0.25) {
      this.events.emit('toast', { message: 'Bait Saver! Your bait was not consumed.' });
    } else {
      this.economy.consumeBaitForCast();
    }
    
    this.setPhase('casting');
  }

  private enterWaiting(): void {
    let waitMultiplier = this.economy.waitMultiplier();
    if (this.lockedRolls && this.lockedRolls.T > 0) {
      waitMultiplier *= (1 - this.lockedRolls.T * 0.1); 
    }
    this.waitDurationSeconds = rollWaitSeconds(waitMultiplier);
    this.setPhase('waiting');
  }

  /**
   * The player gave up waiting and reeled in before anything bit. No cost beyond the bait
   * already spent at cast time — unless a fish had quietly nibbled the bait off already,
   * which is only revealed now, on pulling the line back in.
   */
  private reelInEarly(): void {
    if (Math.random() < BAIT_STOLEN_CHANCE) {
      this.economy.consumeBaitForCast();
      this.enterMissed('bait-stolen');
    } else {
      this.enterMissed('reeled-early');
    }
  }

  private enterBite(): void {
    const precisionBonus = precisionSkillBonus(this.lockedPrecision);
    const S = this.lockedRolls ? this.lockedRolls.S : 0;
    const skill = this.economy.effectiveSkill(precisionBonus + S * 5);
    const weights = computeRarityWeights(skill, this.economy.hasSonarScanner(), this.economy.snapshot.level);
    const rarity = rollRarity(weights);
    const fight = rollFightValue(rarity, this.economy.charmerVarianceReduction());

    this.hookedRarity = rarity;
    this.fightValue = fight;
    this.skillValueForBite = skill;
    this.currentReactionWindowMs = computeReactionWindowMs(skill, fight, this.economy.reelWindowFlatBonusMs());

    this.setPhase('bite');
    this.events.emit('biteStarted', { rarity, fightValue: fight, skillValue: skill });
  }

  /**
   * Shared by a manual tap and by the window simply timing out — both roll the same
   * skill-vs-fight odds, so a bite left unattended can still land (or still escape) rather
   * than defaulting to an automatic miss. `auto` is true for the timeout path and for the
   * AFK toggle (which resolves immediately rather than waiting out the window); a manual tap
   * gets a small early-reaction bonus that tapers off through the window.
   */
  private attemptReel(auto: boolean): void {
    let successChance = computeSuccessChance(this.skillValueForBite, this.fightValue, this.economy.trapperSuccessBonus());
    if (!auto) {
      const elapsedRatio = (this.phaseElapsed * 1000) / this.currentReactionWindowMs;
      if (elapsedRatio < 0.4) successChance = Math.min(0.97, successChance + 0.08);
    }
    const success = Math.random() < successChance;
    this.events.emit('biteReacted', { success });

    if (!success) {
      this.enterMissed('escaped');
      return;
    }

    // Even a mechanically-successful reel sometimes comes up empty — the hook slips at the
    // last second, or the fish strips the bait clean off without ever getting caught.
    const twist = Math.random();
    if (twist < BAIT_STOLEN_CHANCE) {
      this.economy.consumeBaitForCast();
      this.enterMissed('bait-stolen');
      return;
    } else if (twist < BAIT_STOLEN_CHANCE + NO_CATCH_CHANCE) {
      this.enterMissed('no-catch');
      return;
    }

    this.setPhase('resolving');

    const precisionBonus = precisionSkillBonus(this.lockedPrecision);
    const theme = this.economy.currentTheme();

    const L = this.lockedRolls ? this.lockedRolls.L : 0;
    const S = this.lockedRolls ? this.lockedRolls.S : 0;
    const rarity = this.hookedRarity ?? 'common';

    const result = resolveCatch(this.economy, precisionBonus, theme, L, S, rarity);
    const levelResult = this.economy.addXp(result.xpAwarded);
    this.lastCatch = result;

    if ((L === 6 || L === 7) && Math.random() < 0.25) {
      this.events.emit('patienceBonusAwarded', {});
    }

    this.events.emit('catchResolved', { result });
    this.events.emit('xpGained', { amount: result.xpAwarded, ...levelResult });
    if (levelResult.themeChanged) this.events.emit('themeChanged', { theme: levelResult.newTheme });

    this.setPhase('celebrating');
  }

  private enterMissed(reason: 'early' | 'late' | 'no-react' | 'escaped' | 'no-catch' | 'bait-stolen' | 'reeled-early'): void {
    this.events.emit('missed', { reason });
    this.setPhase('missed');
  }

  private enterIdle(): void {
    this.setPhase('idle');
  }

  private setPhase(phase: FishingPhase): void {
    this.phase = phase;
    this.phaseElapsed = 0;
    this.events.emit('phaseChanged', { phase });
  }
}
