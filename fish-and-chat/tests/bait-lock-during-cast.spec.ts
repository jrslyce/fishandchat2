import { expect, test } from '@playwright/test';

test('bait stays equipped until the cast is finished', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
  await page.locator('#title-start').click();

  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.economy.snapshot.baitInventory.nightcrawlers = 5;
    game.economy.snapshot.baitInventory.marshmallows = 5;
    game.economy.setBaitTutorialCompleted(true);
    game.craftingSystem.equipBait('nightcrawlers');
    game.ui.renderHud();
  });

  await expect(page.locator('#hud-bait-btn-nightcrawlers')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#game-canvas').click();
  await page.locator('#game-canvas').click();
  await page.waitForFunction(() => (window as any).__FISH_GAME__.fishingState.getPhase() === 'waiting');

  await expect(page.locator('#hud-bait-btn-marshmallows')).toBeDisabled();
  const equippedDuringCast = await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    const switched = game.craftingSystem.equipBait('marshmallows');
    return { switched, bait: game.economy.equippedBait().id };
  });
  expect(equippedDuringCast).toEqual({ switched: false, bait: 'nightcrawlers' });

  await page.locator('#game-canvas').click();
  await page.waitForFunction(() => (window as any).__FISH_GAME__.fishingState.getPhase() === 'idle');
  await expect(page.locator('#hud-bait-btn-marshmallows')).toBeEnabled();
  await page.locator('#hud-bait-btn-marshmallows').click();
  await expect(page.locator('#hud-bait-btn-marshmallows')).toHaveAttribute('aria-pressed', 'true');
});
