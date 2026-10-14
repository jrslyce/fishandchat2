import { expect, test } from '@playwright/test';

async function tap(page: import('@playwright/test').Page, pointerId: number) {
  const canvas = page.locator('#game-canvas');
  await canvas.dispatchEvent('pointerdown', { pointerId, button: 0 });
  await canvas.dispatchEvent('pointerup', { pointerId, button: 0 });
}

test('verifies 318x496 dimensions, dock view, and circular bobber zoom view during cast', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // 1. Verify exact 318px x 496px dimensions
  const appBox = await page.locator('#app').boundingBox();
  expect(appBox).not.toBeNull();
  expect(Math.round(appBox!.width)).toBe(318);
  expect(Math.round(appBox!.height)).toBe(496);

  const canvasBox = await page.locator('#game-canvas').boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(Math.round(canvasBox!.width)).toBe(318);
  expect(Math.round(canvasBox!.height)).toBe(496);

  // Wait for initial render frames
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 15);

  // Dismiss title screen
  await page.locator('#title-start').click();
  await expect(page.locator('#title-screen')).toBeHidden();

  // In idle dock view, bobber-view class must not be present
  await expect(page.locator('#game-canvas')).not.toHaveClass(/bobber-view/);
  await expect(page.locator('#bobber-circle-ring')).not.toHaveClass(/active/);

  // Capture dock view screenshot
  const dockScreenshot = await page.locator('#app').screenshot({ omitBackground: true });
  await testInfo.attach('dock-view-transparent', {
    body: dockScreenshot,
    contentType: 'image/png',
  });

  // Tap 1: idle -> aiming
  await tap(page, 1);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'aiming');

  // Verify cast gauge track UI appears in #phase-indicator
  await expect(page.locator('#phase-indicator .gauge-track')).toBeVisible();

  // Tap 2: lock gauge -> casting -> waiting
  await page.waitForTimeout(250);
  await tap(page, 2);

  // Wait for waiting state
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'waiting', undefined, {
    timeout: 5000,
  });

  // Verify canvas transitioned to bobber-view with circular cut and active ring
  await expect(page.locator('#game-canvas')).toHaveClass(/bobber-view/);
  await expect(page.locator('#bobber-circle-ring')).toHaveClass(/active/);

  // Capture bobber view screenshot
  const bobberScreenshot = await page.locator('#app').screenshot({ omitBackground: true });
  await testInfo.attach('bobber-circle-view-transparent', {
    body: bobberScreenshot,
    contentType: 'image/png',
  });


  // Wait for bite to occur
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'bite', undefined, {
    timeout: 25000,
  });

  // Verify phase indicator shows bite
  await expect(page.locator('#phase-indicator .phase-label.bite')).toBeVisible();

  // Tap 3: bite -> resolving -> celebrating or missed
  await tap(page, 3);

  // Wait for resolution
  await page.waitForFunction(
    () => {
      const state = window.__THREE_GAME_DIAGNOSTICS__?.state;
      return state === 'celebrating' || state === 'missed' || state === 'idle';
    },
    undefined,
    { timeout: 12000 }
  );

  // In celebration, missed, or idle: view mode MUST return to dock view (circle removed)
  await expect(page.locator('#game-canvas')).not.toHaveClass(/bobber-view/);
  await expect(page.locator('#bobber-circle-ring')).not.toHaveClass(/active/);

  expect(consoleErrors).toEqual([]);
});

test('user can open menus like bait shop and close with visible upper-right X button, backdrop, or escape', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Dismiss title screen
  await page.locator('#title-start').click();
  await expect(page.locator('#title-screen')).toBeHidden();

  // 1. Open bait shop by clicking hud-bait-pill
  await page.locator('#hud-bait-pill').click();
  await expect(page.locator('#modal-host')).toBeVisible();
  await expect(page.locator('#modal-host .modal')).toBeVisible();

  // Verify the modal header and title are fully visible inside #app bounds
  const modalHeader = page.locator('#modal-host .modal-header');
  await expect(modalHeader).toBeVisible();
  await expect(modalHeader.locator('h3')).toHaveText('Shop');

  // Verify close X button is visible in the upper right
  const closeBtn = page.locator('#modal-host .modal-close');
  await expect(closeBtn).toBeVisible();

  const appBox = (await page.locator('#app').boundingBox())!;
  const headerBox = (await modalHeader.boundingBox())!;
  const closeBox = (await closeBtn.boundingBox())!;

  // Header and close button must be within the top portion of #app, not pushed off-screen
  expect(headerBox.y).toBeGreaterThanOrEqual(appBox.y);
  expect(closeBox.y).toBeGreaterThanOrEqual(appBox.y);
  expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(appBox.x + appBox.width + 1);

  // Capture screenshot of bait shop modal with close X button
  const screenshotPath = '/Users/jared/.gemini/antigravity-ide/brain/73752e80-981d-4185-a047-8df1be4a7fd5/bait_shop_modal.png';
  const shopScreenshot = await page.locator('#app').screenshot({ path: screenshotPath, omitBackground: true });
  await testInfo.attach('bait-shop-modal-visible-close', {
    body: shopScreenshot,
    contentType: 'image/png',
  });

  // Close by clicking the 'X' button
  await closeBtn.click();
  await expect(page.locator('#modal-host')).toBeHidden();

  // 2. Open via HUD rail and close via backdrop click
  await page.locator('#rail-toggle').click();
  await page.locator('#btn-shop').click();
  await expect(page.locator('#modal-host')).toBeVisible();

  // Click backdrop outside the modal
  await page.locator('#modal-host').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#modal-host')).toBeHidden();

  // 3. Open another menu (settings) and close with Escape key
  await page.locator('#rail-toggle').click();
  await page.locator('#btn-settings').click();
  await expect(page.locator('#modal-host')).toBeVisible();
  await expect(page.locator('#modal-host .modal-header h3')).toHaveText('Settings');
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal-host')).toBeHidden();
});

test('basket full triggers Barnaby tutorial bubble, glowing basket animation, market tutorial explanation, and glowing Sell All button', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Wait for initial render and dismiss title screen
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);
  await page.locator('#title-start').click();
  await expect(page.locator('#title-screen')).toBeHidden();

  // Dismiss early cast tutorial if active
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.economy.markCastTutorialSeen();
    game.economy.markReelTutorialSeen();
  });

  // Verify initially basket is not full and badge is not glowing
  await expect(page.locator('#basket-badge')).not.toHaveClass(/basket-glow/);

  // Fill the basket to capacity (8 fish)
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    const capacity = game.economy.basketCapacity();
    for (let i = 0; i < capacity; i++) {
      game.economy.addToBasket({
        catchId: 'pebble-bass',
        weightKg: 1.4,
        isTrash: false,
      });
    }
  });

  // Basket badge should now display 8/8 and have the basket-glow class
  await expect(page.locator('#hud-basket-count')).toHaveText('8/8');
  await expect(page.locator('#basket-badge')).toHaveClass(/basket-glow/);

  // Barnaby's tutorial bubble should appear with the basket tutorial message
  await expect(page.locator('#tutorial-bubble')).toBeVisible();
  await expect(page.locator('#tutorial-bubble')).toHaveClass(/basket-tutorial/);
  await expect(page.locator('#tutorial-bubble-text')).toContainText('Your basket is full! Tap the basket in the bottom left to visit the market.');

  // Capture dock screenshot showing glowing basket badge and Barnaby tutorial bubble
  const dockBasketShotPath = '/Users/jared/.gemini/antigravity-ide/brain/73752e80-981d-4185-a047-8df1be4a7fd5/basket_full_dock_view.png';
  const dockBasketShot = await page.locator('#app').screenshot({ path: dockBasketShotPath, omitBackground: true });
  await testInfo.attach('basket-full-dock-view', {
    body: dockBasketShot,
    contentType: 'image/png',
  });

  // Click the glowing basket badge in the bottom left to open the market
  await page.locator('#basket-badge').click({ force: true });
  await expect(page.locator('#modal-host')).toBeVisible();
  await expect(page.locator('#modal-host .modal')).toBeVisible();
  await expect(page.locator('#modal-host .modal-header h3')).toHaveText("Monger Barnaby's Market");

  // In the market: Barnaby's speech bubble explains what to do
  const speechBubble = page.locator('#modal-host .market-speech-bubble');
  await expect(speechBubble).toBeVisible();
  await expect(speechBubble).toHaveClass(/market-tutorial-active/);
  await expect(speechBubble).toContainText('Sell your fish to earn coins and empty your basket!');
  await expect(speechBubble).toContainText('Sell All');

  // The Sell All button must be glow-highlighted
  const sellAllBtn = page.locator('#modal-host button[data-action="sell-all"][data-method="sell"]');
  await expect(sellAllBtn).toBeVisible();
  await expect(sellAllBtn).toHaveClass(/tutorial-glow/);

  // Capture market screenshot showing Barnaby tutorial dialogue and glowing Sell All button
  const marketShotPath = '/Users/jared/.gemini/antigravity-ide/brain/73752e80-981d-4185-a047-8df1be4a7fd5/basket_full_market_tutorial.png';
  const marketShot = await page.locator('#app').screenshot({ path: marketShotPath, omitBackground: true });
  await testInfo.attach('basket-full-market-tutorial', {
    body: marketShot,
    contentType: 'image/png',
  });

  // Click Sell All
  await sellAllBtn.click({ force: true });

  // Basket is now emptied (0/8)
  await expect(page.locator('#hud-basket-count')).toHaveText('0/8');

  // Sell All is now disabled and no longer glowing
  await expect(sellAllBtn).toBeDisabled();
  await expect(sellAllBtn).not.toHaveClass(/tutorial-glow/);

  // Barnaby says the basket is empty
  await expect(speechBubble).toContainText('Basket is empty');

  // Close the market modal via upper-right close button
  await page.locator('#modal-host .modal-close').click();
  await expect(page.locator('#modal-host')).toBeHidden();

  // On dock: basket-badge is no longer glowing
  await expect(page.locator('#basket-badge')).not.toHaveClass(/basket-glow/);
});


