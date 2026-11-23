import {
  ARCHETYPE_CATALOG,
  BAIT_CATALOG,
  BASE_TONE_CATALOG,
  BASKET_BASE_CAPACITY,
  BOX_OF_NOT_FISH_CONTENTS,
  BOX_OF_NOT_FISH_COST_CANDY_BARS,
  CLOTHING_CATALOG,
  FISHBOT_CATALOG,
  FISH_CATALOG,
  MATERIAL_BUNDLE_CATALOG,
  PREMIUM_CATALOG,
  TRASH_CATALOG,
  UPGRADE_CATALOG,
  calculateFishValue,
  themeForLevel,
  xpToNextLevel,
  type ArchetypeId,
  type BaitDefinition,
  type ClothingSlot,
  type FishbotDefinition,
  type MaterialId,
  type ThemeId,
  type UpgradeId,
} from './data';
import type { SaveManager } from '../core/SaveManager';
import { createDefaultSaveState, migrateSaveState, type BasketItem, type ChannelCandyWallet, type CosmeticSlot, type FishRecord, type FishbotState, type GameSaveStateV1, type OutfitPreset } from './SaveState';
import type { DailyQuest, Milestone, StoryChapter } from './StoryGoals';
import { getLoreBottle, type LoreBottle } from './LoreBottles';
import { getCurioRelic, type CurioRelic } from './RelicSystem';

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  themeChanged: boolean;
  newTheme: ThemeId;
}

export interface UpgradePurchaseResult {
  ok: boolean;
  reason?: 'max-tier' | 'insufficient-coins' | 'insufficient-materials' | 'insufficient-candy-bars' | 'already-owned' | 'unknown-item' | 'server-required';
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
  // Debug-only, in-memory (never persisted): forces the next successfully-resolved catch.
  private debugForceNextCatch: 'treasure' | 'lucky-coin-bottle' | null = null;
  // Barnaby's 5th-click secret, in-memory (never persisted): the next bait purchase grants 13
  // instead of 10.
  private bakersDozenNextBait = false;
  private serverCandyMode = false;

  constructor(private readonly saveManager: SaveManager<GameSaveStateV1>) {
    this.state = migrateSaveState(saveManager.load());
  }

  get snapshot(): Readonly<GameSaveStateV1> {
    return this.state;
  }

  get usesServerCandy(): boolean { return this.serverCandyMode; }

  setServerCandyMode(): void {
    this.serverCandyMode = true;
    this.state.candyBars = 0;
    const active = this.state.channelCandyWallets?.[this.state.activeChannelId ?? 'local'];
    if (active) active.balance = 0;
  }

  setDebugForceNextCatch(kind: 'treasure' | 'lucky-coin-bottle' | null): void {
    this.debugForceNextCatch = kind;
  }

  /** Reads and clears the debug override in one step, so it only ever applies to one catch. */
  consumeDebugForcedCatch(): 'treasure' | 'lucky-coin-bottle' | null {
    const kind = this.debugForceNextCatch;
    this.debugForceNextCatch = null;
    return kind;
  }

  hasLuckyCoinBottle(): boolean {
    return Boolean(this.state.hasLuckyCoinBottle);
  }

  unlockLuckyCoinBottle(): void {
    if (this.state.hasLuckyCoinBottle) return;
    this.state.hasLuckyCoinBottle = true;
    this.persist();
  }

  setLuckyCoinBottle(unlocked: boolean): void {
    this.state.hasLuckyCoinBottle = unlocked;
    this.persist();
  }

  setBakersDozenNextBait(active: boolean): void {
    this.bakersDozenNextBait = active;
  }

  hasSeenCastTutorial(): boolean {
    return this.state.hasSeenCastTutorial;
  }

  markCastTutorialSeen(): void {
    if (this.state.hasSeenCastTutorial) return;
    this.state.hasSeenCastTutorial = true;
    this.persist();
  }

  hasSeenReelTutorial(): boolean {
    return this.state.hasSeenReelTutorial;
  }

  markReelTutorialSeen(): void {
    if (this.state.hasSeenReelTutorial) return;
    this.state.hasSeenReelTutorial = true;
    this.persist();
  }

  getTutorialCastCount(): number {
    return this.state.tutorialCastCount ?? 0;
  }

  setTutorialCastCount(count: number): void {
    this.state.tutorialCastCount = count;
    this.persist();
  }

  incrementTutorialCastCount(): number {
    this.state.tutorialCastCount = (this.state.tutorialCastCount ?? 0) + 1;
    this.persist();
    return this.state.tutorialCastCount;
  }

  hasCompletedBaitTutorial(): boolean {
    return Boolean(this.state.hasCompletedBaitTutorial);
  }

  markBaitTutorialCompleted(): void {
    if (this.state.hasCompletedBaitTutorial) return;
    this.state.hasCompletedBaitTutorial = true;
    this.persist();
  }

  setBaitTutorialCompleted(completed: boolean): void {
    this.state.hasCompletedBaitTutorial = completed;
    this.persist();
  }

  resetTutorial(): void {
    this.state.tutorialCastCount = 0;
    this.state.hasCompletedBaitTutorial = false;
    this.state.hasSeenCastTutorial = false;
    this.state.hasSeenReelTutorial = false;
    this.state.equippedBaitId = 'pleb-bait';
    this.persist();
  }

  persist(): void {
    this.state.lastActiveAtMs = Date.now();
    this.syncActiveCandyWallet();
    this.saveManager.save(this.state);
  }

  flushCloudSave(keepalive = false): Promise<void> {
    return this.saveManager.flush(keepalive);
  }

  /** The active balance belongs to the channel where these bars were earned. */
  setActiveChannel(channelId: string, name: string, avatarUrl: string | null): void {
    const wallets = this.state.channelCandyWallets ??= {};
    const hadWallets = Object.keys(wallets).length > 0;
    if (hadWallets) this.syncActiveCandyWallet();
    const existing = wallets[channelId];
    // A legacy save has only one balance. Assign it to the first channel it opens.
    const legacyBalance = !hadWallets ? this.state.candyBars : 0;
    wallets[channelId] = existing ?? { name, avatarUrl, balance: legacyBalance, activity: [] };
    wallets[channelId].name = name || wallets[channelId].name;
    wallets[channelId].avatarUrl = avatarUrl ?? wallets[channelId].avatarUrl;
    this.state.activeChannelId = channelId;
    this.state.candyBars = wallets[channelId].balance;
    this.persist();
  }

  candyWallets(): Readonly<Record<string, ChannelCandyWallet>> {
    return this.state.channelCandyWallets ?? {};
  }

  /** Mirror the EBS ledger for display. Twitch balances and entitlements come from this snapshot. */
  applyServerWallet(snapshot: {
    wallets: Array<{ channel_id: string; balance: number }>;
    ownedPremiumItemIds: string[];
    activity?: Array<{ channel_id: string; delta: number; reason: string; created_at: string }>;
  }): void {
    const wallets = this.state.channelCandyWallets ??= {};
    for (const wallet of Object.values(wallets)) wallet.balance = 0;
    for (const entry of snapshot.wallets) {
      if (!Number.isSafeInteger(entry.balance) || entry.balance < 0) continue;
      const previous = wallets[entry.channel_id];
      wallets[entry.channel_id] = previous
        ? { ...previous, balance: entry.balance }
        : { name: `Channel ${entry.channel_id}`, avatarUrl: null, balance: entry.balance, activity: [] };
    }
    if (snapshot.activity) {
      for (const wallet of Object.values(wallets)) wallet.activity = [];
      for (const entry of snapshot.activity) {
        const wallet = wallets[entry.channel_id];
        const at = Date.parse(`${entry.created_at.replace(' ', 'T')}Z`);
        if (wallet && Number.isFinite(at)) wallet.activity.push({ at, delta: entry.delta, reason: entry.reason });
      }
    }
    this.state.candyBars = wallets[this.state.activeChannelId ?? 'local']?.balance ?? 0;
    const previouslyOwned = new Set(this.state.ownedPremiumItemIds);
    this.state.ownedPremiumItemIds = snapshot.ownedPremiumItemIds.filter((id) => PREMIUM_CATALOG.some((item) => item.id === id));
    for (const [slot, id] of [['rod', 'golden-rod-skin'], ['fishbot', 'starlight-fishbot-skin'], ['trail', 'sparkle-trail']] as const) {
      if (!previouslyOwned.has(id) && this.ownsPremiumItem(id)) this.state.equippedCosmetics[slot] = id;
      if (!this.ownsPremiumItem(id)) this.state.equippedCosmetics[slot] = null;
    }
    this.persist();
  }

  private syncActiveCandyWallet(): void {
    const wallet = this.state.channelCandyWallets?.[this.state.activeChannelId ?? 'local'];
    if (!wallet) return;
    const delta = this.state.candyBars - wallet.balance;
    if (delta) {
      wallet.balance = this.state.candyBars;
      wallet.activity = [{ at: Date.now(), delta }, ...(wallet.activity ?? [])].slice(0, 20);
    }
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

  waitMultiplier(): number {
    return this.hasUpgrade('led-bobber') ? 0.8 : 1;
  }

  fishbotIntervalMultiplier(): number {
    let mult = this.hasUpgrade('turbo-bot-chip') ? 0.7 : 1;
    if (this.hasDiscoveredRelic('relic_clockwork_heart')) mult *= 0.85;
    return mult;
  }

  saleMultiplier(): number {
    let mult = 1.0;
    if (this.hasUpgrade('insulated-cooler')) mult += 0.15;
    if (this.hasDiscoveredRelic('relic_galleon_doubloon')) mult += 0.15;
    if (this.state.level >= 50) mult += 0.25;
    if (this.state.prestige > 0) mult += this.state.prestige * 0.10;
    return mult;
  }

  hasSonarScanner(): boolean {
    return this.hasUpgrade('sonar-scanner');
  }

  basketCapacity(): number {
    if (this.ownsPremiumItem('bottomless-tackle-box')) {
      return 999999;
    }
    let capacity = BASKET_BASE_CAPACITY;
    capacity += this.upgradeTier('heavy-duty-basket') * 6;
    capacity += this.upgradeTier('tackle-apron') * 6;
    return capacity;
  }

  /** Existing lucky-cast saver and the permanent tackle-box bonus add before one roll. */
  baitSaveChance(luckyCast: boolean): number {
    return Math.min(1, (luckyCast ? 0.25 : 0) + (this.ownsPremiumItem('bottomless-tackle-box') ? 0.4 : 0));
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
    const grant = this.bakersDozenNextBait ? 13 : 10;
    this.bakersDozenNextBait = false;
    this.state.baitInventory[baitId] = (this.state.baitInventory[baitId] ?? 0) + grant;
    return { ok: true };
  }

  addBait(baitId: string, count: number): void {
    this.state.baitInventory[baitId] = (this.state.baitInventory[baitId] ?? 0) + count;
    this.persist();
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
    let gearBonus =
      this.upgradeTier('carbon-rod') * 8 +
      this.upgradeTier('braided-line') * 8 +
      this.upgradeTier('trophy-lure') * 8 +
      this.equippedBait().skillBonus;
    if (this.hasDiscoveredRelic('relic_leviathan_tooth')) gearBonus += 15;
    const tacticianMult = 1 + this.archetypePoints('tactician') * 0.1;
    return this.state.level + this.archetypePoints('brawler') * 2 + gearBonus * tacticianMult + castPrecisionBonus;
  }

  /** Flat reel-window bonus (rod tier + Patience archetype) — fed into the fight formula's flatBonusMs, separate from the skill-vs-fight margin. */
  reelWindowFlatBonusMs(): number {
    let bonus = this.upgradeTier('carbon-rod') * 150 + this.archetypePoints('patience') * 250;
    if (this.hasDiscoveredRelic('relic_barnaby_pipe')) bonus += 150;
    return bonus;
  }

  // --- Skill points & archetypes ------------------------------------------

  skillPointsAvailable(): number {
    return this.state.skillPoints;
  }

  archetypePoints(id: ArchetypeId): number {
    return this.state.archetypePoints[id] ?? 0;
  }

  spendSkillPoint(id: ArchetypeId): boolean {
    if (!ARCHETYPE_CATALOG.some((a) => a.id === id)) return false;
    if (this.state.skillPoints <= 0) return false;
    this.state.skillPoints -= 1;
    this.state.archetypePoints[id] = (this.state.archetypePoints[id] ?? 0) + 1;
    return true;
  }

  trapperSuccessBonus(): number {
    return this.archetypePoints('trapper') * 0.02;
  }

  charmerVarianceReduction(): number {
    return this.archetypePoints('charmer') * 0.02;
  }

  // --- Fish Value & Pricing ------------------------------------------------

  getFishValue(catchId: string, weightKg: number, golden = false): number {
    const species = FISH_CATALOG.find((f) => f.id === catchId);
    if (!species) return 0;
    return calculateFishValue(species, weightKg, this.saleMultiplier()) * (golden ? 3 : 1);
  }

  // --- Catch Records & Scrap Book -----------------------------------------

  recordCatch(catchId: string, weightKg: number, isTrash: boolean): void {
    if (!this.state.discoveredCatchIds.includes(catchId)) {
      this.state.discoveredCatchIds.push(catchId);
    }
    if (!isTrash) {
      if (!this.state.fishRecords) {
        this.state.fishRecords = {};
      }
      const existing = this.state.fishRecords[catchId] ?? { count: 0, maxWeightKg: 0 };
      this.state.fishRecords[catchId] = {
        count: existing.count + 1,
        maxWeightKg: Math.max(existing.maxWeightKg, weightKg),
      };
    }
  }

  getFishRecord(catchId: string): FishRecord {
    return this.state.fishRecords?.[catchId] ?? { count: 0, maxWeightKg: 0 };
  }

  // --- Basket -------------------------------------------------------------

  basketFull(): boolean {
    return this.state.basket.length >= this.basketCapacity();
  }

  addToBasket(item: BasketItem): boolean {
    if (this.basketFull()) return false;
    if (!item.isTrash) {
      const record = this.getFishRecord(item.catchId);
      if (record.count === 0 || item.weightKg > record.maxWeightKg) item.protectedCatch = true;
    }
    this.state.basket.push(item);
    this.recordCatch(item.catchId, item.weightKg, item.isTrash);
    return true;
  }

  removeFromBasket(index: number): BasketItem | null {
    return this.state.basket.splice(index, 1)[0] ?? null;
  }

  // --- Trash bucket (separate from the basket, uncapped) -------------------

  trashBucket(): readonly BasketItem[] {
    return this.state.trashBucket;
  }

  /** Unlike addToBasket, this never fails — trash doesn't compete with fish for basket room. */
  addToTrashBucket(item: BasketItem): boolean {
    this.state.trashBucket.push(item);
    this.recordCatch(item.catchId, item.weightKg, true);
    return true;
  }

  removeFromTrashBucket(index: number): BasketItem | null {
    return this.state.trashBucket.splice(index, 1)[0] ?? null;
  }

  // --- Progression -------------------------------------------------------

  /** A single catch (even a lucky Golden legendary) can only carry the player through one level-up — excess XP is clamped rather than chaining into further levels. */
  addXp(amount: number): LevelUpResult {
    const themeBefore = themeForLevel(this.state.level);
    this.state.xp += amount;
    let leveledUp = false;
    if (this.state.xp >= xpToNextLevel(this.state.level)) {
      this.state.xp -= xpToNextLevel(this.state.level);
      this.state.level += 1;
      this.state.skillPoints += 1;
      leveledUp = true;
      const cap = xpToNextLevel(this.state.level) - 1;
      if (this.state.xp > cap) this.state.xp = cap;
    }
    const newTheme = themeForLevel(this.state.level);
    return { leveledUp, newLevel: this.state.level, themeChanged: newTheme !== themeBefore, newTheme };
  }

  currentTheme(): ThemeId {
    return themeForLevel(this.state.level);
  }

  /** Sets the player level directly (debug override), updating skill points, resetting level XP, and returning theme changes. */
  setLevel(targetLevel: number): LevelUpResult {
    const oldLevel = this.state.level;
    const clampedLevel = Math.max(1, Math.min(50, Math.floor(targetLevel)));
    const themeBefore = themeForLevel(oldLevel);

    if (clampedLevel > oldLevel) {
      this.state.skillPoints += clampedLevel - oldLevel;
    } else if (clampedLevel < oldLevel) {
      this.state.skillPoints = Math.max(0, this.state.skillPoints - (oldLevel - clampedLevel));
    }

    this.state.level = clampedLevel;
    this.state.xp = 0;
    this.persist();

    const newTheme = themeForLevel(this.state.level);
    return {
      leveledUp: clampedLevel > oldLevel,
      newLevel: this.state.level,
      themeChanged: newTheme !== themeBefore,
      newTheme,
    };
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
    // Client-side catches and quests cannot mint Bits-backed bars in a Twitch wallet.
    if (this.serverCandyMode) return;
    this.state.candyBars += amount;
  }

  spendCandyBars(amount: number): boolean {
    if (this.serverCandyMode) return false;
    if (this.state.candyBars < amount) return false;
    this.state.candyBars -= amount;
    return true;
  }

  ownsPremiumItem(id: string): boolean {
    return this.state.ownedPremiumItemIds.includes(id);
  }

  buyPremiumItem(id: string): UpgradePurchaseResult {
    if (this.serverCandyMode) return { ok: false, reason: 'server-required' };
    const def = PREMIUM_CATALOG.find((p) => p.id === id);
    if (!def) return { ok: false, reason: 'unknown-item' };
    const isStreamEvent = id === 'rainbow-totem' || id === 'mega-chum-bucket' || id === 'whale-call-horn';
    if (!isStreamEvent && this.ownsPremiumItem(id)) return { ok: false, reason: 'already-owned' };
    if (this.state.candyBars < def.costCandyBars) return { ok: false, reason: 'insufficient-candy-bars' };

    this.state.candyBars -= def.costCandyBars;
    if (id === 'rainbow-totem') {
      this.activateStreamBuff('rainbow-totem', 300);
    } else if (id === 'mega-chum-bucket') {
      this.activateStreamBuff('mega-chum-bucket', 600);
    } else if (id === 'whale-call-horn') {
      this.addCoins(100);
    } else {
      if (!this.state.ownedPremiumItemIds.includes(id)) {
        this.state.ownedPremiumItemIds.push(id);
      }
      const cosmeticSlot = id === 'golden-rod-skin' ? 'rod' : id === 'starlight-fishbot-skin' ? 'fishbot' : id === 'sparkle-trail' ? 'trail' : null;
      if (cosmeticSlot) this.state.equippedCosmetics[cosmeticSlot] = id;
    }
    this.persist();
    return { ok: true };
  }

  buyMaterialBundle(id: string): UpgradePurchaseResult {
    if (this.serverCandyMode) return { ok: false, reason: 'server-required' };
    const def = MATERIAL_BUNDLE_CATALOG.find((b) => b.id === id);
    if (!def) return { ok: false, reason: 'unknown-item' };
    if (this.state.candyBars < def.costCandyBars) return { ok: false, reason: 'insufficient-candy-bars' };
    this.state.candyBars -= def.costCandyBars;
    this.addMaterial(def.materialId, def.quantity);
    return { ok: true };
  }

  /** Grants exactly 20 disclosed, player-selected trash items to the uncapped trash bucket. */
  buyBoxOfNotFish(contents: readonly { trashId: string; quantity: number }[] = BOX_OF_NOT_FISH_CONTENTS): BoxOpenResult {
    if (this.serverCandyMode) return { ok: false, reason: 'server-required', itemsGranted: 0 };
    const total = contents.reduce((sum, entry) => sum + entry.quantity, 0);
    const unique = new Set(contents.map((entry) => entry.trashId));
    if (total !== 20 || unique.size !== contents.length || contents.some((entry) =>
      !Number.isInteger(entry.quantity) || entry.quantity < 0 || !TRASH_CATALOG.some((trash) => trash.id === entry.trashId)
    )) return { ok: false, reason: 'unknown-item', itemsGranted: 0 };
    if (this.state.candyBars < BOX_OF_NOT_FISH_COST_CANDY_BARS) {
      return { ok: false, reason: 'insufficient-candy-bars', itemsGranted: 0 };
    }
    this.state.candyBars -= BOX_OF_NOT_FISH_COST_CANDY_BARS;

    let itemsGranted = 0;
    for (const entry of contents) {
      const trash = TRASH_CATALOG.find((t) => t.id === entry.trashId);
      if (!trash) continue;
      for (let i = 0; i < entry.quantity; i++) {
        const [min, max] = trash.weightRangeKg;
        this.addToTrashBucket({
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

    const hasMaster = this.ownsPremiumItem('master-salvage-magnet');
    const doubleChance = hasMaster ? 0.5 : (this.hasUpgrade('salvage-magnet') ? 0.3 : 0);
    const doubled = doubleChance > 0 && Math.random() < doubleChance;
    const amount = doubled ? 2 : 1;
    this.addMaterial(def.recyclesInto, amount);
    return { success: true, materialId: def.recyclesInto, amount, roll, targetLimit };
  }

  addRandomGarbage(count: number): void {
    for (let i = 0; i < count; i++) {
      const trash = TRASH_CATALOG[Math.floor(Math.random() * TRASH_CATALOG.length)];
      const [min, max] = trash.weightRangeKg;
      const weight = min + (max - min) * Math.random();
      this.addToTrashBucket({
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

  hopperCapacity(id: string): number {
    const normalCapacity = 10 + 5 * (this.state.fishbots[id]?.hopperTier ?? 0);
    return normalCapacity * (this.ownsPremiumItem('bottomless-tackle-box') ? 5 : 1);
  }

  hopperFull(id?: string): boolean {
    if (!id) return this.state.fishbotHopper.length >= this.ownedFishbots().reduce((sum, bot) => sum + this.hopperCapacity(bot.id), 0);
    return this.state.fishbotHopper.filter((item) => item.sourceBotId === id).length >= this.hopperCapacity(id);
  }

  addToHopper(item: BasketItem): boolean {
    if (this.hopperFull(item.sourceBotId)) return false;
    this.state.fishbotHopper.push(item);
    return true;
  }

  /** Trash always drains (its bucket is uncapped); fish stays queued in the hopper once the basket is full. */
  claimHopper(autoOnly = false): BasketItem[] {
    const claimed: BasketItem[] = [];
    const remaining: BasketItem[] = [];
    for (const item of this.state.fishbotHopper) {
      if (autoOnly && !this.state.fishbots[item.sourceBotId ?? '']?.autoUnload) {
        remaining.push(item);
        continue;
      }
      if (item.isTrash) {
        this.addToTrashBucket(item);
        claimed.push(item);
      } else if (!this.basketFull()) {
        this.addToBasket(item);
        claimed.push(item);
      } else {
        remaining.push(item);
      }
    }
    this.state.fishbotHopper = remaining;
    return claimed;
  }

  buyBotModule(id: string, module: 'hopper' | 'unload' | 'salvage' | 'trophy'): UpgradePurchaseResult {
    const bot = this.state.fishbots[id];
    if (!bot?.owned) return { ok: false, reason: 'unknown-item' };
    const tier = bot.hopperTier ?? 0;
    if ((module === 'hopper' && tier >= 3) || (module === 'unload' && bot.autoUnload) ||
        ((module === 'salvage' || module === 'trophy') && bot.unlockedModes?.includes(module))) return { ok: false, reason: 'max-tier' };
    const coins = module === 'hopper' ? 250 * (tier + 1) : module === 'unload' ? 600 : 400;
    const metal = module === 'hopper' ? tier + 1 : module === 'unload' ? 3 : 2;
    if (this.state.coins < coins) return { ok: false, reason: 'insufficient-coins' };
    if ((this.state.materials.metal ?? 0) < metal) return { ok: false, reason: 'insufficient-materials' };
    this.state.coins -= coins;
    this.state.materials.metal -= metal;
    if (module === 'hopper') bot.hopperTier = tier + 1;
    else if (module === 'unload') bot.autoUnload = true;
    else { bot.unlockedModes = [...(bot.unlockedModes ?? []), module]; bot.mode = module; }
    this.persist();
    return { ok: true };
  }

  setBotMode(id: string, mode: 'balanced' | 'salvage' | 'trophy'): boolean {
    const bot = this.state.fishbots[id];
    if (!bot?.owned || (mode !== 'balanced' && !bot.unlockedModes?.includes(mode))) return false;
    bot.mode = mode;
    this.persist();
    return true;
  }

  buySorterTray(): UpgradePurchaseResult {
    if (this.state.sorterTrayOwned) return { ok: false, reason: 'already-owned' };
    if (this.state.coins < 900) return { ok: false, reason: 'insufficient-coins' };
    if ((this.state.materials.metal ?? 0) < 4) return { ok: false, reason: 'insufficient-materials' };
    this.state.coins -= 900;
    this.state.materials.metal -= 4;
    this.state.sorterTrayOwned = true;
    this.state.autoSellRarities = ['common', 'uncommon'];
    this.persist();
    return { ok: true };
  }

  toggleAutoSellRarity(rarity: string): boolean {
    if (!this.state.sorterTrayOwned || !['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(rarity)) return false;
    const selected = new Set(this.state.autoSellRarities ?? []);
    if (selected.has(rarity)) selected.delete(rarity); else selected.add(rarity);
    this.state.autoSellRarities = [...selected];
    this.persist();
    return true;
  }

  recordAutoSale(value: number): void {
    this.state.autoSaleCount = (this.state.autoSaleCount ?? 0) + 1;
    this.state.autoSaleCoins = (this.state.autoSaleCoins ?? 0) + value;
  }

  lastActiveAtMs(): number {
    return this.state.lastActiveAtMs;
  }

  // --- Audio mix ------------------------------------------------------------

  setAudioMix(mix: Partial<GameSaveStateV1['audio']>): void {
    Object.assign(this.state.audio, mix);
  }

  /** Wipes user save data and returns in-memory state to clean defaults. */
  wipeUserData(): void {
    this.saveManager.clear();
    this.state = createDefaultSaveState();
    this.debugForceNextCatch = null;
    this.bakersDozenNextBait = false;
    this.persist();
  }

  /** Wipes the save. Caller (UI) is responsible for reloading afterward. */
  resetSave(): void {
    this.wipeUserData();
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

  hasSeenWeatherClothingTip(id: string): boolean {
    return (this.state.seenWeatherClothingTipIds ?? []).includes(id);
  }

  markWeatherClothingTipSeen(id: string): void {
    if (this.hasSeenWeatherClothingTip(id)) return;
    this.state.seenWeatherClothingTipIds = [...(this.state.seenWeatherClothingTipIds ?? []), id];
    this.persist();
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

  cosmeticEquipped(slot: CosmeticSlot): string | null {
    return this.state.equippedCosmetics[slot];
  }

  setCosmeticEquipped(slot: CosmeticSlot, id: string | null): boolean {
    const expected = { rod: 'golden-rod-skin', fishbot: 'starlight-fishbot-skin', trail: 'sparkle-trail' }[slot];
    if (id !== null && (id !== expected || !this.ownsPremiumItem(id))) return false;
    this.state.equippedCosmetics[slot] = id;
    this.persist();
    return true;
  }

  outfitPresets(): ReadonlyArray<OutfitPreset | null> {
    return this.state.outfitPresets;
  }

  saveOutfitPreset(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= 3) return false;
    this.state.outfitPresets[index] = {
      name: `Outfit ${index + 1}`,
      clothing: { ...this.state.equippedClothing },
      baseToneId: this.state.baseToneId,
      cosmetics: { ...this.state.equippedCosmetics },
    };
    this.persist();
    return true;
  }

  wearOutfitPreset(index: number): boolean {
    const preset = this.state.outfitPresets[index];
    if (!preset) return false;
    for (const slot of ['hat', 'jacket', 'pants', 'shoes'] as ClothingSlot[]) {
      const id = preset.clothing[slot];
      if (id === null || this.ownsClothing(id)) this.state.equippedClothing[slot] = id;
    }
    if (BASE_TONE_CATALOG.some((tone) => tone.id === preset.baseToneId)) this.state.baseToneId = preset.baseToneId;
    for (const slot of ['rod', 'fishbot', 'trail'] as CosmeticSlot[]) {
      const id = preset.cosmetics[slot];
      this.setCosmeticEquipped(slot, id && this.ownsPremiumItem(id) ? id : null);
    }
    this.persist();
    return true;
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

  // --- Story, Quests & Milestones -------------------------------------------

  setDailyQuests(quests: DailyQuest[], timestamp: number): void {
    this.state.dailyQuests = quests;
    this.state.lastDailyQuestRefreshMs = timestamp;
    this.persist();
  }

  updateDailyQuests(quests: DailyQuest[]): void {
    this.state.dailyQuests = quests;
    this.persist();
  }

  updateChapterProgress(objectiveId: string, value: number): void {
    this.state.storyProgress[objectiveId] = value;
    this.persist();
  }

  claimStoryChapter(chapter: StoryChapter): void {
    if (!this.state.completedChapterIds.includes(chapter.id)) {
      this.state.completedChapterIds.push(chapter.id);
    }
    this.state.activeStoryChapter = Math.min(STORY_CHAPTERS_COUNT, chapter.chapterNumber + 1);
    this.addCoins(chapter.rewards.coins);
    this.addXp(chapter.rewards.xp);
    if (chapter.rewards.candyBars) {
      this.addCandyBars(chapter.rewards.candyBars);
    }
    if (chapter.rewards.titleReward) {
      this.unlockTitle(chapter.rewards.titleReward);
      this.equipTitle(chapter.rewards.titleReward);
    }
    if (chapter.rewards.bait) {
      this.addBait(chapter.rewards.bait.id, chapter.rewards.bait.count);
    }
    this.persist();
  }

  claimMilestone(milestone: Milestone): void {
    if (!this.state.claimedMilestoneIds.includes(milestone.id)) {
      this.state.claimedMilestoneIds.push(milestone.id);
    }
    this.addCoins(milestone.reward.coins);
    this.addXp(milestone.reward.xp);
    if (milestone.reward.candyBars) {
      this.addCandyBars(milestone.reward.candyBars);
    }
    this.persist();
  }

  // --- Stats & Streaks -----------------------------------------------------

  incrementTotalFishCaught(count = 1, weightKg = 0): void {
    this.state.totalFishCaught = (this.state.totalFishCaught ?? 0) + count;
    this.state.totalWeightKgCaught = Math.round(((this.state.totalWeightKgCaught ?? 0) + weightKg) * 10) / 10;
  }

  incrementTotalTrashRecycled(): void {
    this.state.totalTrashRecycled = (this.state.totalTrashRecycled ?? 0) + 1;
  }

  incrementTotalPerfectCasts(): void {
    this.state.totalPerfectCasts = (this.state.totalPerfectCasts ?? 0) + 1;
  }

  incrementCatchStreak(): number {
    this.state.catchStreak = (this.state.catchStreak ?? 0) + 1;
    if (this.state.catchStreak > (this.state.bestCatchStreak ?? 0)) {
      this.state.bestCatchStreak = this.state.catchStreak;
    }
    return this.state.catchStreak;
  }

  resetCatchStreak(): void {
    this.state.catchStreak = 0;
  }

  catchStreak(): number {
    return this.state.catchStreak ?? 0;
  }

  bestCatchStreak(): number {
    return this.state.bestCatchStreak ?? 0;
  }

  // --- Prestige ------------------------------------------------------------

  prestige(): number {
    return this.state.prestige ?? 0;
  }

  canPrestige(): boolean {
    return this.state.level >= 50;
  }

  triggerPrestige(): boolean {
    if (!this.canPrestige()) return false;
    this.state.prestige = (this.state.prestige ?? 0) + 1;
    this.state.level = 1;
    this.state.xp = 0;
    this.unlockTitle(`Prestige ${this.state.prestige} Legend`);
    this.equipTitle(`Prestige ${this.state.prestige} Legend`);
    this.persist();
    return true;
  }

  // --- Stream Buffs --------------------------------------------------------

  activateStreamBuff(buffId: string, durationSeconds: number): void {
    if (!this.state.activeStreamBuffs) this.state.activeStreamBuffs = {};
    const now = Date.now();
    const currentExpiry = this.state.activeStreamBuffs[buffId] ?? 0;
    const baseTime = currentExpiry > now ? currentExpiry : now;
    this.state.activeStreamBuffs[buffId] = baseTime + durationSeconds * 1000;
    this.persist();
  }

  isStreamBuffActive(buffId: string): boolean {
    const expiry = this.state.activeStreamBuffs?.[buffId] ?? 0;
    return expiry > Date.now();
  }

  streamBuffRemainingSeconds(buffId: string): number {
    const expiry = this.state.activeStreamBuffs?.[buffId] ?? 0;
    return Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
  }

  // --- Titles --------------------------------------------------------------

  equippedTitle(): string | null {
    return this.state.equippedTitle ?? null;
  }

  equipTitle(title: string | null): void {
    this.state.equippedTitle = title;
    this.persist();
  }

  unlockedTitles(): readonly string[] {
    return this.state.unlockedTitles ?? [];
  }

  unlockTitle(title: string): void {
    if (!this.state.unlockedTitles) this.state.unlockedTitles = [];
    if (!this.state.unlockedTitles.includes(title)) {
      this.state.unlockedTitles.push(title);
      this.persist();
    }
  }

  // --- Community Boss Raids & Group Goals -----------------------------------

  activeCommunityGoalId(): string {
    return this.state.activeCommunityGoalId ?? 'ancient-leviathan';
  }

  setActiveCommunityGoalId(id: string): void {
    this.state.activeCommunityGoalId = id;
    this.persist();
  }

  communityGoalProgress(): number {
    return this.state.communityGoalProgress ?? 0;
  }

  setCommunityGoalProgress(progress: number): void {
    this.state.communityGoalProgress = progress;
    this.persist();
  }

  completedCommunityGoalIds(): readonly string[] {
    return this.state.completedCommunityGoalIds ?? [];
  }

  recordCommunityGoalCompletion(goalId: string): void {
    if (!this.state.completedCommunityGoalIds) {
      this.state.completedCommunityGoalIds = [];
    }
    if (!this.state.completedCommunityGoalIds.includes(goalId)) {
      this.state.completedCommunityGoalIds.push(goalId);
    }
    this.state.totalCommunityGoalsCompleted = (this.state.totalCommunityGoalsCompleted ?? 0) + 1;
    this.persist();
  }

  totalCommunityGoalsCompleted(): number {
    return this.state.totalCommunityGoalsCompleted ?? 0;
  }

  // Provider for current weather (can be hooked to LivingWorldSystem)
  currentWeather: () => string = () => 'clear';

  setWeatherProvider(provider: () => string): void {
    this.currentWeather = provider;
  }

  // --- Lore Bottles & Curio Relics -----------------------------------------

  discoveredBottleIds(): string[] {
    return this.state.discoveredBottleIds ?? [];
  }

  discoverBottle(id: string): boolean {
    if (!this.state.discoveredBottleIds) {
      this.state.discoveredBottleIds = [];
    }
    if (this.state.discoveredBottleIds.includes(id)) {
      return false;
    }
    this.state.discoveredBottleIds.push(id);
    const bottle = getLoreBottle(id);
    if (bottle) {
      if (bottle.reward.coins) this.addCoins(bottle.reward.coins);
      if (bottle.reward.xp) this.addXp(bottle.reward.xp);
      if (bottle.reward.candyBars) this.addCandyBars(bottle.reward.candyBars);
    }
    this.persist();
    return true;
  }

  discoveredRelicIds(): string[] {
    return this.state.discoveredRelicIds ?? [];
  }

  discoverRelic(id: string): boolean {
    if (!this.state.discoveredRelicIds) {
      this.state.discoveredRelicIds = [];
    }
    if (this.state.discoveredRelicIds.includes(id)) {
      return false;
    }
    this.state.discoveredRelicIds.push(id);
    this.persist();
    return true;
  }

  hasDiscoveredBottle(id: string): boolean {
    return this.discoveredBottleIds().includes(id);
  }

  hasDiscoveredRelic(id: string): boolean {
    return this.discoveredRelicIds().includes(id);
  }

  getDiscoveredBottles(): LoreBottle[] {
    return this.discoveredBottleIds()
      .map((id) => getLoreBottle(id))
      .filter((b): b is LoreBottle => b !== undefined);
  }

  getDiscoveredRelics(): CurioRelic[] {
    return this.discoveredRelicIds()
      .map((id) => getCurioRelic(id))
      .filter((r): r is CurioRelic => r !== undefined);
  }
}
const STORY_CHAPTERS_COUNT = 5;
