import { expect, test } from '@playwright/test';

async function startPastFishingTutorial(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.locator('#title-start:not([disabled])').click();
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.economy.snapshot.hasSeenCastTutorial = true;
    game.economy.snapshot.hasSeenReelTutorial = true;
    game.economy.snapshot.hasCompletedBaitTutorial = true;
  });
}

test('Barnaby offers a coin-only sunny hat and character tap opens the Closet', async ({ page }) => {
  await startPastFishingTutorial(page);
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.livingWorld.setWeather('clear');
    game.economy.addCoins(10);
    game.events.emit('coinsChanged', {});
  });
  await expect(page.locator('#tutorial-bubble-content')).toContainText('Straw Hat for 60 coins');
  await page.locator('#tutorial-bubble-text').click();
  await expect(page.locator('#modal-host')).toContainText('Straw Hat');
  const coinsBeforeHat = await page.evaluate(() => (window as any).__FISH_GAME__.economy.snapshot.coins as number);
  await page.locator('button[data-action="buy-clothing"][data-id="straw-hat"]').click();
  await expect(page.locator('button[data-action="equip-clothing"][data-id="straw-hat"]')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__FISH_GAME__.economy.snapshot.coins)).toBe(coinsBeforeHat - 60);
  await page.locator('.modal-close').click();

  const point = await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    const body = game.playerCharacter.player.skin.body;
    const world = body.getWorldPosition(game.camera.position.clone());
    world.project(game.camera);
    const rect = game.canvas.getBoundingClientRect();
    return { x: rect.left + (world.x + 1) * rect.width / 2, y: rect.top + (1 - world.y) * rect.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#modal-host')).toContainText('Closet');
  expect(await page.evaluate(() => (window as any).__FISH_GAME__.fishingState.getPhase())).toBe('idle');
});

test('Barnaby offers a coin-only rain slicker in rainy weather', async ({ page }) => {
  await startPastFishingTutorial(page);
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.livingWorld.setWeather('rain');
    game.economy.addCoins(70);
    game.events.emit('coinsChanged', {});
  });
  await expect(page.locator('#tutorial-bubble-content')).toContainText('Rain Slicker for 120 coins');
  await page.locator('#tutorial-bubble-text').click();
  await expect(page.locator('button[data-action="buy-clothing"][data-id="rain-slicker"]')).toBeVisible();
  const coinsBeforeSlicker = await page.evaluate(() => (window as any).__FISH_GAME__.economy.snapshot.coins as number);
  await page.locator('button[data-action="buy-clothing"][data-id="rain-slicker"]').click();
  await expect(page.locator('button[data-action="equip-clothing"][data-id="rain-slicker"]')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__FISH_GAME__.economy.snapshot.coins)).toBe(coinsBeforeSlicker - 120);
});
