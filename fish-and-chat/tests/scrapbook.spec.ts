import { expect, test } from '@playwright/test';

test('fish weight dynamically affects market pricing and sell payout', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Dismiss title screen
  await page.locator('#title-start').click();
  await expect(page.locator('#title-screen')).toBeHidden();

  // Add two Sunny Perch with different weights: min weight (0.2kg) and max weight (0.6kg)
  // Sunny Perch: baseValue 6, weightRangeKg: [0.2, 0.6]
  // 0.2kg -> weightFactor = 0.70 -> value = round(6 * 0.70) = 4
  // 0.6kg -> weightFactor = 1.60 -> value = round(6 * 1.60) = 10
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.economy.addToBasket({
      catchId: 'sunny-perch',
      weightKg: 0.2,
      isTrash: false,
      caughtAt: Date.now(),
    });
    game.economy.addToBasket({
      catchId: 'sunny-perch',
      weightKg: 0.6,
      isTrash: false,
      caughtAt: Date.now(),
    });
  });

  // Open market
  await page.locator('#rail-toggle').click();
  await page.locator('#btn-market').click();
  await expect(page.locator('#modal-host')).toBeVisible();

  // Verify the two rows display different coin prices based on weight
  const rows = page.locator('#modal-host .modal-list li.row');
  await expect(rows).toHaveCount(2);

  const row1Meta = rows.nth(0).locator('.row-meta');
  const row2Meta = rows.nth(1).locator('.row-meta');

  await expect(row1Meta).toContainText('0.20kg');
  await expect(row1Meta).toContainText('4');

  await expect(row2Meta).toContainText('0.60kg');
  await expect(row2Meta).toContainText('10');

  // Verify the heavier fish sells for more
  const initialCoins = await page.evaluate(() => (window as any).__FISH_GAME__.economy.snapshot.coins);
  
  // Sell the 0.20kg fish (index 0)
  await rows.nth(0).locator('button[data-action="sell"]').click();
  const coinsAfterFirst = await page.evaluate(() => (window as any).__FISH_GAME__.economy.snapshot.coins);
  expect(coinsAfterFirst - initialCoins).toBe(4);

  // Wait for list to update to 1 row, then sell the remaining fish (0.60kg fish)
  await expect(page.locator('#modal-host .modal-list li.row')).toHaveCount(1);
  await page.locator('#modal-host .modal-list li.row button[data-action="sell"]').click();
  const coinsAfterSecond = await page.evaluate(() => (window as any).__FISH_GAME__.economy.snapshot.coins);
  expect(coinsAfterSecond - coinsAfterFirst).toBe(10);

  await page.locator('#modal-host .modal-close').click();
  await expect(page.locator('#modal-host')).toBeHidden();
});

test('scrap book starts closed with cover showing "User Name\'s Big Fish Tails" and tracks largest catch & count', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Dismiss title screen
  await page.locator('#title-start').click();
  await expect(page.locator('#title-screen')).toBeHidden();

  // Set a specific display name (simulating Muxy / Twitch username resolution)
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.economy.setDisplayNameOverride('Captain Hook');
    // Add two catches of Copper Trout (0.8kg and 1.35kg)
    game.economy.addToBasket({
      catchId: 'copper-trout',
      weightKg: 0.8,
      isTrash: false,
      caughtAt: Date.now(),
    });
    game.economy.addToBasket({
      catchId: 'copper-trout',
      weightKg: 1.35,
      isTrash: false,
      caughtAt: Date.now(),
    });
  });

  // Open the Scrap Book via HUD rail
  await page.locator('#rail-toggle').click();
  await page.locator('#btn-collection').click();

  // 1. Verify it starts CLOSED with the book cover
  await expect(page.locator('#modal-host')).toBeVisible();
  const cover = page.locator('#modal-host .scrapbook-cover-book');
  await expect(cover).toBeVisible();

  // Verify cover text matches "User Name's Big Fish Tails"
  await expect(page.locator('.scrapbook-author-text')).toHaveText("Captain Hook's");
  await expect(page.locator('.scrapbook-title-text')).toHaveText('Big Fish Tails');

  // Verify Open button exists
  const openBtn = page.locator('#modal-host button[data-action="open-scrapbook"]');
  await expect(openBtn).toBeVisible();

  // 2. Click Open button to flip open the Scrap Book
  await openBtn.click();

  // Verify inside pages are visible
  await expect(page.locator('.scrapbook-open-header')).toBeVisible();
  await expect(page.locator('.scrapbook-open-title')).toContainText("Captain Hook's Big Fish Tails");

  // Verify Copper Trout entry displays count = 2, largest = 1.35 kg
  const troutRow = page.locator('#modal-host li.scrapbook-row:has-text("Copper Trout")');
  await expect(troutRow).toBeVisible();
  await expect(troutRow.locator('.scrapbook-stats-bar')).toContainText('Caught: 2');
  await expect(troutRow.locator('.scrapbook-stats-bar')).toContainText('Largest: 1.35 kg');

  // 3. Click "Close Book" button to return to cover
  await page.locator('#modal-host button[data-action="close-scrapbook"]').click();
  await expect(page.locator('#modal-host .scrapbook-cover-book')).toBeVisible();
  await expect(page.locator('.scrapbook-title-text')).toHaveText('Big Fish Tails');

  // 4. Close modal and reopen: it MUST start closed on the cover again
  await page.locator('#modal-host .modal-close').click();
  await expect(page.locator('#modal-host')).toBeHidden();

  await page.locator('#rail-toggle').click();
  await page.locator('#btn-collection').click();
  await expect(page.locator('#modal-host .scrapbook-cover-book')).toBeVisible();
  await expect(page.locator('.scrapbook-title-text')).toHaveText('Big Fish Tails');
});
