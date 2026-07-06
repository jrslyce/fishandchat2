import type { Economy } from '../game/Economy';
import type { ClothingSlot, UpgradeId } from '../game/data';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/events';

/** Thin orchestration over Economy's crafting-bench mutations, emitting UI/audio events. */
export class CraftingSystem {
  constructor(
    private readonly economy: Economy,
    private readonly events: EventBus<GameEventMap>,
  ) {}

  purchaseUpgrade(id: UpgradeId): boolean {
    const result = this.economy.buyUpgrade(id);
    this.events.emit('upgradePurchased', { id, ok: result.ok });
    if (result.ok) this.events.emit('coinsChanged', {});
    return result.ok;
  }

  recycleBasketItem(index: number): boolean {
    const item = this.economy.snapshot.basket[index];
    if (!item || !item.isTrash) return false;
    this.economy.recycleTrash(item.catchId);
    this.economy.removeFromBasket(index);
    return true;
  }

  /** Recycles every trash item currently in the basket; returns how many were processed. */
  recycleAllTrash(): number {
    const basket = this.economy.snapshot.basket;
    let successCount = 0;
    let failCount = 0;
    const salvaged: Record<string, number> = {};

    for (let i = basket.length - 1; i >= 0; i -= 1) {
      if (basket[i].isTrash) {
        const catchId = basket[i].catchId;
        const res = this.economy.recycleTrash(catchId);
        if (res) {
          if (res.success && res.materialId) {
            successCount += 1;
            salvaged[res.materialId] = (salvaged[res.materialId] ?? 0) + res.amount;
          } else {
            failCount += 1;
          }
          this.events.emit('trashRecycled', { result: res, catchId });
        }
        this.economy.removeFromBasket(i);
      }
    }

    if (successCount > 0 || failCount > 0) {
      this.events.emit('recycleFinished', { successCount, failCount, salvaged });
    }

    return successCount;
  }

  craftLuckyDucky(): boolean {
    const ok = this.economy.craftLuckyDucky();
    if (ok) {
      this.events.emit('toast', { message: 'Crafted Lucky Rubber Ducky!' });
    }
    return ok;
  }

  useLuckyDucky(): boolean {
    const ok = this.economy.useLuckyDucky();
    if (ok) {
      this.events.emit('toast', { message: 'Lucky Rubber Ducky Squeaked! 85% salvage rate active!' });
    }
    return ok;
  }

  purchaseBait(baitId: string): boolean {
    const result = this.economy.buyBait(baitId);
    this.events.emit('baitPurchased', { id: baitId, ok: result.ok });
    if (result.ok) this.events.emit('coinsChanged', {});
    return result.ok;
  }

  equipBait(baitId: string): boolean {
    const ok = this.economy.equipBait(baitId);
    if (ok) this.events.emit('baitEquipped', { id: baitId });
    return ok;
  }

  purchaseFishbot(id: string): boolean {
    const result = this.economy.buyFishbot(id);
    this.events.emit('fishbotPurchased', { id, ok: result.ok });
    if (result.ok) this.events.emit('coinsChanged', {});
    return result.ok;
  }

  addRandomGarbage(count: number): void {
    this.economy.addRandomGarbage(count);
    this.events.emit('upgradePurchased', { id: 'carbon-rod', ok: false }); // cheap way to refresh open modal
  }

  purchasePremiumItem(id: string): boolean {
    const result = this.economy.buyPremiumItem(id);
    this.events.emit('premiumItemPurchased', { id, ok: result.ok });
    if (result.ok) this.events.emit('candyBarsChanged', {});
    return result.ok;
  }

  purchaseMaterialBundle(id: string): boolean {
    const result = this.economy.buyMaterialBundle(id);
    this.events.emit('materialBundlePurchased', { id, ok: result.ok });
    if (result.ok) this.events.emit('candyBarsChanged', {});
    return result.ok;
  }

  purchaseBoxOfNotFish(): boolean {
    const result = this.economy.buyBoxOfNotFish();
    this.events.emit('boxOfNotFishOpened', { ok: result.ok, itemsGranted: result.itemsGranted });
    if (result.ok) {
      this.events.emit('candyBarsChanged', {});
      this.events.emit('toast', { message: `Opened a Box of Not Fish — ${result.itemsGranted} items!` });
    }
    return result.ok;
  }

  /** Credits candy bars after a Muxy bits purchase completes. */
  grantCandyBars(amount: number): void {
    this.economy.addCandyBars(amount);
    this.economy.persist();
    this.events.emit('candyBarsChanged', {});
    this.events.emit('toast', { message: `+${amount} Candy Bars!` });
  }

  // --- Player character: closet -------------------------------------------

  purchaseClothing(id: string): boolean {
    const result = this.economy.buyClothing(id);
    this.events.emit('clothingPurchased', { id, ok: result.ok });
    if (result.ok) {
      this.events.emit('coinsChanged', {});
      this.economy.persist();
    }
    return result.ok;
  }

  equipClothing(slot: ClothingSlot, id: string | null): boolean {
    const ok = this.economy.equipClothing(slot, id);
    if (ok) {
      this.events.emit('clothingEquipped', { slot, id });
      this.economy.persist();
    }
    return ok;
  }

  setBaseTone(id: string): boolean {
    const ok = this.economy.setBaseTone(id);
    if (ok) {
      this.events.emit('baseToneChanged', { id });
      this.economy.persist();
    }
    return ok;
  }

  setDisplayNameOverride(name: string | null): void {
    this.economy.setDisplayNameOverride(name);
    this.events.emit('displayNameChanged', { name: this.economy.displayName() });
    this.economy.persist();
  }
}
