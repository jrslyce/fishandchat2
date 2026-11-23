import { expect, test } from '@playwright/test';

test('200-bar box grants permanent basket, bot endurance, and additive bait saving', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ Economy }, { SaveManager }, { createDefaultSaveState }] = await Promise.all([
      import(String('/src/game/Economy.ts')), import(String('/src/core/SaveManager.ts')), import(String('/src/game/SaveState.ts')),
    ]);
    const state = createDefaultSaveState();
    state.candyBars = 199;
    const economy = new Economy(new SaveManager(createDefaultSaveState, state));
    const before = { basket: economy.basketCapacity(), hopper: economy.hopperCapacity('fishbot-mk1'),
      normalSave: economy.baitSaveChance(false), luckySave: economy.baitSaveChance(true) };
    const denied = economy.buyPremiumItem('bottomless-tackle-box');
    economy.addCandyBars(1);
    const granted = economy.buyPremiumItem('bottomless-tackle-box');
    const repeat = economy.buyPremiumItem('bottomless-tackle-box');
    const after = { basket: economy.basketCapacity(), hopper: economy.hopperCapacity('fishbot-mk1'),
      normalSave: economy.baitSaveChance(false), luckySave: economy.baitSaveChance(true), bars: economy.snapshot.candyBars };
    return { before, denied, granted, repeat, after };
  });
  expect(result.before).toEqual({ basket: 8, hopper: 10, normalSave: 0, luckySave: 0.25 });
  expect(result.denied.ok).toBe(false);
  expect(result.granted.ok).toBe(true);
  expect(result.repeat.ok).toBe(false);
  expect(result.after).toEqual({ basket: 999999, hopper: 50, normalSave: 0.4, luckySave: 0.65, bars: 0 });
});

test('shop shows all benefits and the owned box animates on the dock', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 5);
  await expect(page.locator('#title-start')).toBeEnabled({ timeout: 10000 });
  await page.locator('#title-start').click();
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.economy.addCandyBars(200);
  });
  await page.locator('#hud-candy-pill').click();
  const row = page.locator('#modal-host li.row').filter({ has: page.locator('button[data-id="bottomless-tackle-box"]') });
  await expect(row).toContainText('200');
  await expect(row).toContainText('5x hopper space');
  await expect(row).toContainText('40 percentage points');
  await expect(row).toContainText('animated golden tackle box');
  await row.locator('button[data-id="bottomless-tackle-box"]').click();
  const start = await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    const box = game.bottomlessTackleBox;
    return { owned: game.economy.ownsPremiumItem('bottomless-tackle-box'), visible: box.group.visible,
      lid: box.lid.rotation.x };
  });
  expect(start.owned).toBe(true);
  expect(start.visible).toBe(true);
  await page.waitForTimeout(250);
  const lidLater = await page.evaluate(() => (window as any).__FISH_GAME__.bottomlessTackleBox.lid.rotation.x as number);
  expect(lidLater).not.toBe(start.lid);
  await page.locator('#modal-host button[data-action="close"]').click();
  await page.screenshot({ path: testInfo.outputPath('owned-bottomless-box.png') });
});
