import { FISH_CATALOG } from '../game/data';
import type { Economy } from '../game/Economy';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';

const STARTING_BONES = 3;
const HAGGLE_FAIL_CHANCE = 0.35;
const DESPERATE_FAIL_CHANCE = 0.6;
const CATCHES_TO_RESET_BONES = 2;

export type SellMethod = 'sell' | 'haggle' | 'desperate';

/**
 * Monger Barnaby's sell flow. Patience bones are ephemeral session state,
 * not persisted: they represent his mood for the current market visit and
 * reset once the player has fished away from the stall for a while.
 */
export class MarketSystem {
  private bones = STARTING_BONES;
  private catchesSinceVisit = 0;

  constructor(
    private readonly economy: Economy,
    private readonly events: EventBus<GameEventMap>,
  ) {
    // Decoupled from GameState: react to catches happening anywhere (rod or fishbot)
    // rather than GameState calling into this system directly.
    this.events.on('catchResolved', () => this.onCatchLogged());
    this.events.on('patienceBonusAwarded', () => {
      this.bones += 1;
      this.events.emit('toast', { message: "Market Patience! Barnaby gained a Patience Bone." });
    });
  }

  get patienceBones(): number {
    return this.bones;
  }

  onMarketOpened(): void {
    this.catchesSinceVisit = 0;
  }

  onCatchLogged(): void {
    this.catchesSinceVisit += 1;
    if (this.catchesSinceVisit >= CATCHES_TO_RESET_BONES && this.bones < STARTING_BONES) {
      this.bones = STARTING_BONES;
      this.catchesSinceVisit = 0;
    }
  }

  sell(basketIndex: number, method: SellMethod): boolean {
    const item = this.economy.snapshot.basket[basketIndex];
    if (!item || item.isTrash) return false;

    const species = FISH_CATALOG.find((fish) => fish.id === item.catchId);
    if (!species) return false;

    let outcomeMultiplier = 1;
    let success = true;

    if (this.bones <= 0) {
      outcomeMultiplier = 0.7;
      if (method !== 'sell') success = false;
    } else if (method === 'haggle') {
      success = Math.random() >= HAGGLE_FAIL_CHANCE;
      if (success) {
        outcomeMultiplier = 1.2;
      } else {
        this.bones -= 1;
        outcomeMultiplier = 0.7;
      }
    } else if (method === 'desperate') {
      if (this.bones < 2) {
        success = false;
        outcomeMultiplier = 0.7;
      } else {
        success = Math.random() >= DESPERATE_FAIL_CHANCE;
        if (success) {
          outcomeMultiplier = 1.5;
        } else {
          this.bones -= 2;
          outcomeMultiplier = 0.7;
        }
      }
    }

    const value = Math.round(species.baseValue * this.economy.saleMultiplier() * outcomeMultiplier);
    this.economy.removeFromBasket(basketIndex);
    this.economy.addCoins(value);

    this.events.emit('marketSold', { catchId: item.catchId, value, method, success });
    this.events.emit('coinsChanged', {});
    if (this.bones <= 0) this.events.emit('marketBonesDepleted', {});

    return true;
  }
}
