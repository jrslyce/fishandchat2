import {
  BAIT_CATALOG,
  BASE_TONE_CATALOG,
  BASKET_BASE_CAPACITY,
  BOX_OF_NOT_FISH_CONTENTS,
  BOX_OF_NOT_FISH_COST_CANDY_BARS,
  CLOTHING_CATALOG,
  FISHBOT_CATALOG,
  MATERIAL_BUNDLE_CATALOG,
  PREMIUM_CATALOG,
  TRASH_CATALOG,
  UPGRADE_CATALOG,
  themeForLevel,
  xpToNextLevel,
  type BaitDefinition,
  type ClothingSlot,
  type FishbotDefinition,
  type MaterialId,
  type ThemeId,
  type UpgradeId,
} from './data';
import type { SaveManager } from '../core/SaveManager';
import { migrateSaveState, type BasketItem, type FishbotState, type GameSaveStateV1 } from './SaveState';

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  themeChanged: boolean;
  newTheme: ThemeId;
}

export interface UpgradePurchaseResult {
  ok: boolean;
  reason?: 'max-tier' | 'insufficient-coins' | 'insufficient-materials' | 'insufficient-candy-bars' | 'already-owned' | 'unknown-item';
}

export interface BoxOpenResult extends UpgradePurchaseResult {
  itemsGranted: number;
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
    this.state = migrateSaveState(saveManager.load());
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

  // --- Candy bars (premium currency) --------------------------------------

  addCandyBars(amount: number): void {
    this.state.candyBars += amount;
  }

  spendCandyBars(amount: number): boolean {
    if (this.state.candyBars < amount) return false;
    this.state.candyBars -= amount;
    return true;
  }

  ownsPremiumItem(id: string): boolean {
    return this.state.ownedPremiumItemIds.includes(id);
  }

  buyPremiumItem(id: string): UpgradePurchaseResult {
    const def = PREMIUM_CATALOG.find((p) => p.id === id);
    if (!def) return { ok: false, reason: 'unknown-item' };
    if (this.ownsPremiumItem(id)) return { ok: false, reason: 'already-owned' };
    if (this.state.candyBars < def.costCandyBars) return { ok: false, reason: 'insufficient-candy-bars' };
    this.state.candyBars -= def.costCandyBars;
    this.state.ownedPremiumItemIds.push(id);
    return { ok: true };
  }

  buyMaterialBundle(id: string): UpgradePurchaseResult {
    const def = MATERIAL_BUNDLE_CATALOG.find((b) => b.id === id);
    if (!def) return { ok: false, reason: 'unknown-item' };
    if (this.state.candyBars < def.costCandyBars) return { ok: false, reason: 'insufficient-candy-bars' };
    this.state.candyBars -= def.costCandyBars;
    this.addMaterial(def.materialId, def.quantity);
    return { ok: true };
  }

  /** Grants the exact, pre-disclosed BOX_OF_NOT_FISH_CONTENTS — no randomized item selection. */
  buyBoxOfNotFish(): BoxOpenResult {
    if (this.state.candyBars < BOX_OF_NOT_FISH_COST_CANDY_BARS) {
      return { ok: false, reason: 'insufficient-candy-bars', itemsGranted: 0 };
    }
    this.state.candyBars -= BOX_OF_NOT_FISH_COST_CANDY_BARS;

    let itemsGranted = 0;
    for (const entry of BOX_OF_NOT_FISH_CONTENTS) {
      const trash = TRASH_CATALOG.find((t) => t.id === entry.trashId);
      if (!trash) continue;
      for (let i = 0; i < entry.quantity; i++) {
        if (this.basketFull()) break;
        const [min, max] = trash.weightRangeKg;
        this.addToBasket({
          catchId: trash.id,
          isTrash: true,
          weightKg: min + (max - min) * Math.random(),
          caughtAt: Date.now(),
        });
        itemsGranted += 1;
      }
    }
    return { ok: true, itemsGranted };
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

  // --- Player character: clothing & appearance ----------------------------

  ownsClothing(id: string): boolean {
    const def = CLOTHING_CATALOG.find((c) => c.id === id);
    if (!def) return false;
    // Premium-sourced items (e.g. the candy-shop party hat) defer ownership
    // to the existing premium-item system rather than this catalog's own
    // owned-list, so there's one purchase flow per item, not two.
    if (def.unlock.type === 'premium') return this.ownsPremiumItem(def.unlock.premiumId);
    return this.state.ownedClothingIds.includes(id);
  }

  buyClothing(id: string): UpgradePurchaseResult {
    const def = CLOTHING_CATALOG.find((c) => c.id === id);
    if (!def) return { ok: false, reason: 'unknown-item' };
    if (this.ownsClothing(id)) return { ok: false, reason: 'already-owned' };

    if (def.unlock.type === 'premium') {
      return this.buyPremiumItem(def.unlock.premiumId);
    }

    const { coins, materials = {} } = def.unlock;
    if (this.state.coins < coins) return { ok: false, reason: 'insufficient-coins' };
    for (const [material, amount] of Object.entries(materials) as [MaterialId, number][]) {
      if ((this.state.materials[material] ?? 0) < amount) return { ok: false, reason: 'insufficient-materials' };
    }

    this.state.coins -= coins;
    for (const [material, amount] of Object.entries(materials) as [MaterialId, number][]) {
      this.state.materials[material] -= amount;
    }
    this.state.ownedClothingIds.push(id);
    return { ok: true };
  }

  equippedClothing(): Record<ClothingSlot, string | null> {
    return this.state.equippedClothing;
  }

  equipClothing(slot: ClothingSlot, id: string | null): boolean {
    if (id !== null) {
      const def = CLOTHING_CATALOG.find((c) => c.id === id);
      if (!def || def.slot !== slot || !this.ownsClothing(id)) return false;
    }
    this.state.equippedClothing[slot] = id;
    return true;
  }

  baseTone(): string {
    return this.state.baseToneId;
  }

  setBaseTone(id: string): boolean {
    if (!BASE_TONE_CATALOG.some((t) => t.id === id)) return false;
    this.state.baseToneId = id;
    return true;
  }

  /**
   * A manually-set local override always wins (it's an explicit "rename my
   * character" action, so it should stick even inside a real Twitch
   * session), then the name TwitchAuthSystem resolved for this viewer, then
   * a generic fallback for contexts with neither (local dev, Playwright).
   */
  displayName(): string {
    return this.state.displayNameOverride?.trim() || this.twitchDisplayName || 'Angler';
  }

  /** Not persisted — re-resolved each session from TwitchAuthSystem's `twitchIdentityResolved` event. */
  private twitchDisplayName: string | null = null;

  setTwitchDisplayName(name: string): void {
    this.twitchDisplayName = name;
  }

  setDisplayNameOverride(name: string | null): void {
    const trimmed = name?.trim() || null;
    this.state.displayNameOverride = trimmed && trimmed.length > 0 ? trimmed.slice(0, 24) : null;
  }
}
