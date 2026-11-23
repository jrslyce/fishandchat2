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
  ) {
    this.events.on('catchResolved', () => this.autoSellEligible());
    this.events.on('fishbotClaimed', () => this.autoSellEligible());
  }

  autoSellEligible(): number {
    const state = this.economy.snapshot;
    if (!state.sorterTrayOwned) return 0;
    const allowed = new Set(state.autoSellRarities ?? []);
    let sold = 0;
    for (let index = state.basket.length - 1; index >= 0; index -= 1) {
      const item = state.basket[index];
      const species = FISH_CATALOG.find((fish) => fish.id === item.catchId);
      if (!species || item.golden || item.protectedCatch || !allowed.has(species.rarity)) continue;
      // Preserve rare catches even when their category is selected.
      if (['rare', 'epic', 'legendary'].includes(species.rarity)) continue;
      const value = this.economy.getFishValue(item.catchId, item.weightKg, item.golden);
      if (this.sell(index)) {
        this.economy.recordAutoSale(value);
        sold += 1;
      }
    }
    return sold;
  }

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

    const value = this.economy.getFishValue(item.catchId, item.weightKg, item.golden);
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

