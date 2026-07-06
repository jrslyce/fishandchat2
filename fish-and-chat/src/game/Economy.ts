import {
  BAIT_CATALOG,
  BASKET_BASE_CAPACITY,
  FISHBOT_CATALOG,
  TRASH_CATALOG,
  UPGRADE_CATALOG,
  themeForLevel,
  xpToNextLevel,
  type BaitDefinition,
  type FishbotDefinition,
  type MaterialId,
  type ThemeId,
  type UpgradeId,
} from './data';
import type { SaveManager } from '../core/SaveManager';
import type { BasketItem, FishbotState, GameSaveStateV1 } from './SaveState';

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  themeChanged: boolean;
  newTheme: ThemeId;
}

export interface UpgradePurchaseResult {
  ok: boolean;
  reason?: 'max-tier' | 'insufficient-coins' | 'insufficient-materials';
}

export interface RecycleResult {
  success: boolean;
  materialId: MaterialId | null;
  amount: number;
  roll: number;
  targetLimit: number;
}

/** Single mutation surface over GameSaveStateV1. Systems read/write through this, never the raw state. */
export class Economy {
  private state: GameSaveStateV1;

  constructor(private readonly saveManager: SaveManager<GameSaveStateV1>) {
    this.state = saveManager.load();
  }

  get snapshot(): Readonly<GameSaveStateV1> {
    return this.state;
  }

  persist(): void {
    this.state.lastActiveAtMs = Date.now();
    this.saveManager.save(this.state);
  }

  // --- Upgrades -------------------------------------------------------

  upgradeTier(id: UpgradeId): number {
    return this.state.upgrades[id] ?? 0;
  }

  hasUpgrade(id: UpgradeId): boolean {
    return this.upgradeTier(id) > 0;
  }

  buyUpgrade(id: UpgradeId): UpgradePurchaseResult {
    const def = UPGRADE_CATALOG.find((u) => u.id === id);
    if (!def) return { ok: false, reason: 'max-tier' };
    const currentTier = this.upgradeTier(id);
    if (currentTier >= def.maxTier) return { ok: false, reason: 'max-tier' };

    const cost = def.costPerTier[currentTier];
    if (this.state.coins < cost.coins) return { ok: false, reason: 'insufficient-coins' };
    for (const [material, amount] of Object.entries(cost.materials) as [MaterialId, number][]) {
      if ((this.state.materials[material] ?? 0) < amount) {
        return { ok: false, reason: 'insufficient-materials' };
      }
    }

    this.state.coins -= cost.coins;
    for (const [material, amount] of Object.entries(cost.materials) as [MaterialId, number][]) {
      this.state.materials[material] -= amount;
    }
    this.state.upgrades[id] = currentTier + 1;
    return { ok: true };
  }

  // --- Derived gameplay modifiers --------------------------------------

  reactionWindowMs(): number {
    return 900 + this.upgradeTier('carbon-rod') * 150;
  }

  waitMultiplier(): number {
    return this.hasUpgrade('led-bobber') ? 0.8 : 1;
  }

  fishbotIntervalMultiplier(): number {
    return this.hasUpgrade('turbo-bot-chip') ? 0.7 : 1;
  }

  saleMultiplier(): number {
    return this.hasUpgrade('insulated-cooler') ? 1.15 : 1;
  }

  hasSonarScanner(): boolean {
    return this.hasUpgrade('sonar-scanner');
  }

  basketCapacity(): number {
    let capacity = BASKET_BASE_CAPACITY;
    if (this.hasUpgrade('heavy-duty-basket')) capacity += 6;
    if (this.hasUpgrade('tackle-apron')) capacity += 6;
    return capacity;
  }

  // --- Bait -------------------------------------------------------------

  equippedBait(): BaitDefinition {
    return BAIT_CATALOG.find((b) => b.id === this.state.equippedBaitId) ?? BAIT_CATALOG[0];
  }

  equipBait(baitId: string): boolean {
    const def = BAIT_CATALOG.find((b) => b.id === baitId);
    if (!def) return false;
    if (!def.free && (this.state.baitInventory[baitId] ?? 0) <= 0) return false;
    this.state.equippedBaitId = baitId;
    return true;
  }

  buyBait(baitId: string): UpgradePurchaseResult {
    const def = BAIT_CATALOG.find((b) => b.id === baitId);
    if (!def || def.free) return { ok: false, reason: 'max-tier' };
    if (this.state.coins < def.costPerTen) return { ok: false, reason: 'insufficient-coins' };
    this.state.coins -= def.costPerTen;
    this.state.baitInventory[baitId] = (this.state.baitInventory[baitId] ?? 0) + 10;
    return { ok: true };
  }

  /** Consumes one unit of the equipped bait for a cast; falls back to Pleb Bait if exhausted. */
  consumeBaitForCast(): void {
    const bait = this.equippedBait();
    if (bait.free) return;
    const remaining = (this.state.baitInventory[bait.id] ?? 0) - 1;
    this.state.baitInventory[bait.id] = Math.max(0, remaining);
    if (remaining <= 0) {
      this.state.equippedBaitId = 'pleb-bait';
    }
  }

  effectiveSkill(castPrecisionBonus: number): number {
    return this.state.level * 2 + this.equippedBait().skillBonus + castPrecisionBonus;
  }

  // --- Basket -------------------------------------------------------------

  basketFull(): boolean {
    return this.state.basket.length >= this.basketCapacity();
  }

  addToBasket(item: BasketItem): boolean {
    if (this.basketFull()) return false;
    this.state.basket.push(item);
    if (!this.state.discoveredCatchIds.includes(item.catchId)) {
      this.state.discoveredCatchIds.push(item.catchId);
    }
    return true;
  }

  removeFromBasket(index: number): BasketItem | null {
    return this.state.basket.splice(index, 1)[0] ?? null;
  }

  // --- Progression -------------------------------------------------------

  addXp(amount: number): LevelUpResult {
    const themeBefore = themeForLevel(this.state.level);
    this.state.xp += amount;
    let leveledUp = false;
    while (this.state.xp >= xpToNextLevel(this.state.level)) {
      this.state.xp -= xpToNextLevel(this.state.level);
      this.state.level += 1;
      leveledUp = true;
    }
    const newTheme = themeForLevel(this.state.level);
    return { leveledUp, newLevel: this.state.level, themeChanged: newTheme !== themeBefore, newTheme };
  }

  currentTheme(): ThemeId {
    return themeForLevel(this.state.level);
  }

  // --- Coins & materials ---------------------------------------------------

  addCoins(amount: number): void {
    this.state.coins += amount;
  }

  spendCoins(amount: number): boolean {
    if (this.state.coins < amount) return false;
    this.state.coins -= amount;
    return true;
  }

  addMaterial(id: MaterialId, amount: number): void {
    this.state.materials[id] = (this.state.materials[id] ?? 0) + amount;
  }

  recycleTrash(catchId: string): RecycleResult | null {
    const def = TRASH_CATALOG.find((t) => t.id === catchId);
    if (!def) return null;
    
    const rate = this.isLuckyDuckyActive() ? 0.85 : 0.60;
    const targetLimit = rate * 10;
    const roll = Math.round((Math.random() * 9.9 + 0.1) * 10) / 10;
    const success = roll <= targetLimit;

    if (!success) {
      return { success: false, materialId: null, amount: 0, roll, targetLimit };
    }

    const doubled = this.hasUpgrade('salvage-magnet') && Math.random() < 0.3;
    const amount = doubled ? 2 : 1;
    this.addMaterial(def.recyclesInto, amount);
    return { success: true, materialId: def.recyclesInto, amount, roll, targetLimit };
  }

  addRandomGarbage(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.basketFull()) break;
      const trash = TRASH_CATALOG[Math.floor(Math.random() * TRASH_CATALOG.length)];
      const [min, max] = trash.weightRangeKg;
      const weight = min + (max - min) * Math.random();
      this.addToBasket({
        catchId: trash.id,
        isTrash: true,
        weightKg: weight,
        caughtAt: Date.now(),
      });
    }
    this.persist();
  }

  isLuckyDuckyActive(): boolean {
    return (this.state.luckyDuckyExpiresAtMs ?? 0) > Date.now();
  }

  luckyDuckyTimeRemainingSec(): number {
    return Math.max(0, Math.ceil(((this.state.luckyDuckyExpiresAtMs ?? 0) - Date.now()) / 1000));
  }

  craftLuckyDucky(): boolean {
    const rubber = this.state.materials['rubber'] ?? 0;
    const fabric = this.state.materials['fabric'] ?? 0;
    if (rubber < 2 || fabric < 1) return false;
    
    this.state.materials['rubber'] -= 2;
    this.state.materials['fabric'] -= 1;
    this.state.luckyDuckyCount = (this.state.luckyDuckyCount ?? 0) + 1;
    this.persist();
    return true;
  }

  useLuckyDucky(): boolean {
    if ((this.state.luckyDuckyCount ?? 0) <= 0) return false;
    this.state.luckyDuckyCount -= 1;
    
    const currentExpiry = this.isLuckyDuckyActive() ? this.state.luckyDuckyExpiresAtMs : Date.now();
    this.state.luckyDuckyExpiresAtMs = currentExpiry + 5 * 60 * 1000;
    this.persist();
    return true;
  }

  // --- Fishbots -----------------------------------------------------------

  fishbotDefinition(id: string): FishbotDefinition | undefined {
    return FISHBOT_CATALOG.find((bot) => bot.id === id);
  }

  fishbotState(id: string): FishbotState | undefined {
    return this.state.fishbots[id];
  }

  ownedFishbots(): FishbotDefinition[] {
    return FISHBOT_CATALOG.filter((bot) => this.state.fishbots[bot.id]?.owned);
  }

  buyFishbot(id: string): UpgradePurchaseResult {
    const def = this.fishbotDefinition(id);
    const bot = this.state.fishbots[id];
    if (!def || !bot) return { ok: false, reason: 'max-tier' };
    if (bot.owned) return { ok: false, reason: 'max-tier' };
    if (this.state.coins < def.cost) return { ok: false, reason: 'insufficient-coins' };
    this.state.coins -= def.cost;
    bot.owned = true;
    bot.nextReadyAtMs = Date.now() + def.baseIntervalSeconds * 1000 * this.fishbotIntervalMultiplier();
    return { ok: true };
  }

  setFishbotNextReady(id: string, timestampMs: number): void {
    const bot = this.state.fishbots[id];
    if (bot) bot.nextReadyAtMs = timestampMs;
  }

  hopperFull(): boolean {
    return this.state.fishbotHopper.length >= 10;
  }

  addToHopper(item: BasketItem): boolean {
    if (this.hopperFull()) return false;
    this.state.fishbotHopper.push(item);
    return true;
  }

  claimHopper(): BasketItem[] {
    const claimed: BasketItem[] = [];
    while (this.state.fishbotHopper.length > 0 && !this.basketFull()) {
      const item = this.state.fishbotHopper.shift();
      if (!item) break;
      this.addToBasket(item);
      claimed.push(item);
    }
    return claimed;
  }

  lastActiveAtMs(): number {
    return this.state.lastActiveAtMs;
  }

  // --- Audio mix ------------------------------------------------------------

  setAudioMix(mix: Partial<GameSaveStateV1['audio']>): void {
    Object.assign(this.state.audio, mix);
  }

  /** Wipes the save. Caller (UI) is responsible for reloading afterward. */
  resetSave(): void {
    this.saveManager.clear();
  }
}
