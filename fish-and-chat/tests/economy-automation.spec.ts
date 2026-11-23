import { expect, test } from '@playwright/test';

test('chosen box contents are complete, validated, and separate from the fish basket', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ Economy }, { SaveManager }, { createDefaultSaveState }] = await Promise.all([
      import(String('/src/game/Economy.ts')), import(String('/src/core/SaveManager.ts')), import(String('/src/game/SaveState.ts')),
    ]);
    const save = createDefaultSaveState();
    save.candyBars = 30;
    const economy = new Economy(new SaveManager(createDefaultSaveState, save));
    for (let i = 0; i < 8; i++) economy.addToBasket({ catchId: 'sunny-perch', isTrash: false, weightKg: 0.3, caughtAt: Date.now() });
    const invalid = economy.buyBoxOfNotFish([{ trashId: 'tin-can', quantity: 19 }]);
    const barsAfterInvalid = economy.snapshot.candyBars;
    const valid = economy.buyBoxOfNotFish([{ trashId: 'tin-can', quantity: 20 }]);
    return { invalid, barsAfterInvalid, valid, bars: economy.snapshot.candyBars, basket: economy.snapshot.basket.length, bucket: economy.trashBucket().length };
  });
  expect(result.invalid.ok).toBe(false);
  expect(result.barsAfterInvalid).toBe(30);
  expect(result.valid.itemsGranted).toBe(20);
  expect(result.bars).toBe(15);
  expect(result.basket).toBe(8);
  expect(result.bucket).toBe(20);
});

test('Golden fish sell for triple value and automation preserves discoveries and records', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ Economy }, { SaveManager }, { createDefaultSaveState }, { MarketSystem }, { EventBus }] = await Promise.all([
      import(String('/src/game/Economy.ts')), import(String('/src/core/SaveManager.ts')), import(String('/src/game/SaveState.ts')),
      import(String('/src/systems/MarketSystem.ts')), import(String('/src/core/EventBus.ts')),
    ]);
    const save = createDefaultSaveState();
    save.coins = 2000;
    save.materials.metal = 10;
    const economy = new Economy(new SaveManager(createDefaultSaveState, save));
    const market = new MarketSystem(economy, new EventBus());
    economy.buySorterTray();
    economy.addToBasket({ catchId: 'sunny-perch', isTrash: false, weightKg: 0.3, caughtAt: Date.now() });
    market.autoSellEligible();
    const firstKept = economy.snapshot.basket.length;
    economy.addToBasket({ catchId: 'sunny-perch', isTrash: false, weightKg: 0.25, caughtAt: Date.now() });
    market.autoSellEligible();
    const autoSaleCount = economy.snapshot.autoSaleCount;
    const normal = economy.getFishValue('sunny-perch', 0.28);
    economy.addToBasket({ catchId: 'sunny-perch', isTrash: false, weightKg: 0.28, caughtAt: Date.now(), golden: true });
    market.autoSellEligible();
    const goldenKept = economy.snapshot.basket.length;
    const goldenValue = economy.getFishValue('sunny-perch', 0.28, true);
    market.sell(goldenKept - 1);
    return { firstKept, autoSaleCount, goldenKept, normal, goldenValue };
  });
  expect(result.firstKept).toBe(1);
  expect(result.autoSaleCount).toBe(1);
  expect(result.goldenKept).toBe(2);
  expect(result.goldenValue).toBe(result.normal * 3);
});

test('bot modules use coins and metal, with independent hoppers and selective auto unload', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ Economy }, { SaveManager }, { createDefaultSaveState }] = await Promise.all([
      import(String('/src/game/Economy.ts')), import(String('/src/core/SaveManager.ts')), import(String('/src/game/SaveState.ts')),
    ]);
    const save = createDefaultSaveState();
    save.coins = 10000;
    save.materials.metal = 20;
    const economy = new Economy(new SaveManager(createDefaultSaveState, save));
    economy.buyFishbot('fishbot-mk1');
    economy.buyFishbot('fishbot-mk2');
    const ids = economy.ownedFishbots().map((bot: { id: string }) => bot.id);
    economy.buyBotModule(ids[0], 'hopper');
    economy.buyBotModule(ids[0], 'unload');
    economy.buyBotModule(ids[0], 'salvage');
    economy.buyBotModule(ids[0], 'trophy');
    economy.setBotMode(ids[0], 'salvage');
    for (let i = 0; i < 10; i++) economy.addToHopper({ catchId: 'tin-can', isTrash: true, weightKg: 0.2, caughtAt: Date.now(), sourceBotId: ids[1] });
    const secondFull = economy.hopperFull(ids[1]);
    const firstFull = economy.hopperFull(ids[0]);
    const coinsBeforeClaim = economy.snapshot.coins;
    const autoClaimed = economy.claimHopper(true).length;
    return { ids, firstCapacity: economy.hopperCapacity(ids[0]), secondFull, firstFull, autoClaimed,
      mode: economy.fishbotState(ids[0])?.mode, unlocked: economy.fishbotState(ids[0])?.unlockedModes,
      coinsBeforeClaim, coinsAfterClaim: economy.snapshot.coins };
  });
  expect(result.ids).toHaveLength(2);
  expect(result.firstCapacity).toBe(15);
  expect(result.secondFull).toBe(true);
  expect(result.firstFull).toBe(false);
  expect(result.autoClaimed).toBe(0);
  expect(result.mode).toBe('salvage');
  expect(result.unlocked).toEqual(['salvage', 'trophy']);
  expect(result.coinsAfterClaim).toBe(result.coinsBeforeClaim);
});

test('Candy shop discloses chosen box quantities and unavailable visuals', async ({ page }) => {
  await page.goto('/');
  await page.locator('#hud-candy-pill').click();
  await expect(page.locator('input.box-quantity')).toHaveCount(6);
  await expect(page.locator('#modal-host')).toContainText('Choose exactly 20 items');
  await expect(page.locator('#modal-host')).toContainText('100 Bits');
  await expect(page.locator('button[data-id="golden-rod-skin"]')).toBeDisabled();
});
