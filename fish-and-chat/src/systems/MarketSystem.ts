import { FISH_CATALOG } from '../game/data';
import type { Economy } from '../game/Economy';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';

export type SellMethod = 'sell';

/**
 * Monger Barnaby's market system.
 * Simple, straightforward selling of caught fish for coins at their current market value.
 */
export class MarketSystem {
  constructor(
    private readonly economy: Economy,
    private readonly events: EventBus<GameEventMap>,
  ) {}

  get patienceBones(): number {
    return 0;
  }

  onMarketOpened(): void {}
  onCatchLogged(): void {}

  sell(basketIndex: number, _method?: string): boolean {
    const item = this.economy.snapshot.basket[basketIndex];
    if (!item || item.isTrash) return false;

    const species = FISH_CATALOG.find((fish) => fish.id === item.catchId);
    if (!species) return false;

    const value = Math.round(species.baseValue * this.economy.saleMultiplier());
    this.economy.removeFromBasket(basketIndex);
    this.economy.addCoins(value);

    this.events.emit('marketSold', { catchId: item.catchId, value, method: 'sell', success: true });
    this.events.emit('coinsChanged', {});

    return true;
  }

  sellAll(_method?: string): number {
    const basket = this.economy.snapshot.basket;
    let count = 0;
    for (let i = basket.length - 1; i >= 0; i -= 1) {
      if (basket[i].isTrash) continue;
      if (this.sell(i)) count += 1;
    }
    return count;
  }
}

