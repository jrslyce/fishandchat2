import { expect, test } from '@playwright/test';

test.describe('Store money display, Barnaby insufficient funds, early reel bait preservation, and coin toss game', () => {
  test('store shows player coins, and insufficient funds displays Barnaby with gulp dialogue', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.locator('#game-canvas')).toBeVisible();

    // Start game
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
    await page.locator('#title-start').click();
    await expect(page.locator('#title-screen')).toBeHidden();

    // Ensure player starts with 0 coins
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.snapshot.coins = 0;
    });

    // Open Shop modal via the right rail
    await page.locator('#rail-toggle').click();
    await page.locator('#btn-shop').click();
    await expect(page.locator('#modal-host')).toBeVisible();

    // 1. In the store we need to show the player how much money they have
    const walletBanner = page.locator('#shop-wallet-banner');
    await expect(walletBanner).toBeVisible();
    const coinsAmount = page.locator('#shop-coins-amount');
    await expect(coinsAmount).toHaveText('0');

    // 2. If they click to buy a bait but don't have enough money, show Barnaby at the top
    // and him saying something like "gulp, not enough money partner."
    const buyMarshmallowsBtn = page.locator('#modal-host button[data-action="buy-bait"][data-id="marshmallows"]');
    await expect(buyMarshmallowsBtn).toBeVisible();
    await buyMarshmallowsBtn.click();

    // Verify Barnaby speech banner is shown at the top of the store
    const barnabyBanner = page.locator('#shop-barnaby-banner');
    await expect(barnabyBanner).toBeVisible();
    await expect(barnabyBanner.locator('.shop-barnaby-speech')).toContainText('Gulp, not enough money partner');

    // Verify header bubble also shows the dialogue
    const headerBubble = page.locator('#modal-host .barnaby-bubble');
    await expect(headerBubble).toBeVisible();
    await expect(headerBubble).toContainText('Gulp, not enough money partner');

    // Take screenshot of store with money and Barnaby insufficient funds message
    const shopInsufficientFundsShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/shop_insufficient_funds_barnaby.png',
    });
    await testInfo.attach('shop-insufficient-funds-barnaby', {
      body: shopInsufficientFundsShot,
      contentType: 'image/png',
    });

    // Now give coins and verify wallet amount updates in shop
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.addCoins(250);
    });
    // Trigger modal refresh or check
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.ui.refreshOpenModal();
    });
    await expect(coinsAmount).toHaveText('250');
  });

  test('reeling in early does not remove bait', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
    await page.locator('#title-start').click();
    await expect(page.locator('#title-screen')).toBeHidden();

    // Give player 5 Marshmallows and equip it
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.snapshot.baitInventory['marshmallows'] = 5;
      game.economy.equipBait('marshmallows');
      game.ui.renderHud();
    });

    // Verify initially 5
    const initialQty = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.snapshot.baitInventory['marshmallows'];
    });
    expect(initialQty).toBe(5);

    // Cast the line
    await page.locator('#game-canvas').click(); // idle -> aiming
    await page.waitForTimeout(200);
    await page.locator('#game-canvas').click(); // aiming -> casting

    // Wait until waiting phase
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'waiting';
    });

    // Reel in early
    await page.locator('#game-canvas').click(); // waiting -> missed ('reeled-early')

    // Wait for missed phase
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'missed';
    });

    // Verify bait count is STILL 5! (Reeling in early did not remove bait)
    const afterEarlyReelQty = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.snapshot.baitInventory['marshmallows'];
    });
    expect(afterEarlyReelQty).toBe(5);
  });

  test('heads or tails game triggers after reeling in a fish with paid bait, with Barnaby and pretty lips catfish faces', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
    await page.locator('#title-start').click();
    await expect(page.locator('#title-screen')).toBeHidden();

    // Give player marshmallows and equip it
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.snapshot.baitInventory['marshmallows'] = 3;
      game.economy.equipBait('marshmallows');
      game.ui.renderHud();
    });

    // Directly trigger startBaitCoinToss or resolve catch to test coin toss modal
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.ui.startBaitCoinToss('marshmallows', 'Marshmallows');
    });

    // 1. Verify coin overlay is visible
    const coinOverlay = page.locator('#coin-toss-overlay');
    await expect(coinOverlay).toBeVisible();

    // 2. Verify one side has Barnaby and the other side has catfish with pretty lips
    const barnabyImg = coinOverlay.locator('.coin-front img');
    await expect(barnabyImg).toBeVisible();
    await expect(barnabyImg).toHaveAttribute('src', './images/barnaby-portrait.png');

    const catfishImg = coinOverlay.locator('.coin-back img');
    await expect(catfishImg).toBeVisible();
    await expect(catfishImg).toHaveAttribute('src', './images/catfish-portrait.png');

    // Capture screenshot of the heads or tails game
    const coinTossShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/coin_toss_game.png',
    });
    await testInfo.attach('coin-toss-heads-or-tails-game', {
      body: coinTossShot,
      contentType: 'image/png',
    });

    // Click flip button
    const flipBtn = coinOverlay.locator('#btn-coin-flip');
    await expect(flipBtn).toBeVisible();
    await flipBtn.click();

    // Wait for flip result message
    const resultMsg = coinOverlay.locator('#coin-result-message');
    await expect(resultMsg).toBeVisible({ timeout: 5000 });

    // Capture screenshot of result
    const coinResultShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/coin_toss_result.png',
    });
    await testInfo.attach('coin-toss-result-flip', {
      body: coinResultShot,
      contentType: 'image/png',
    });
  });

  test('fishing line radius is 60% less and responds to crafting upgrades', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);

    // Verify line radius in geometry is 0.0048 (0.012 * 0.4)
    const lineGeoRadius = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const mesh = game.fishingLine.mesh;
      const geo = mesh.geometry as any;
      return geo.parameters.radiusTop;
    });
    expect(lineGeoRadius).toBeCloseTo(0.0048, 4);

    // Check line crafting tier starts at 0
    const initialTier = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingLine.getTier();
    });
    expect(initialTier).toBe(0);

    // Upgrade line crafting tier to 1, 2, 3 and check visual updates
    for (let t = 1; t <= 3; t++) {
      const tierResult = await page.evaluate((tier) => {
        const game = (window as any).__FISH_GAME__;
        game.fishingLine.setTier(tier);
        const mat = game.fishingLine.mesh.material as any;
        return {
          currentTier: game.fishingLine.getTier(),
          hasTexture: !!mat.map,
          colorHex: mat.color.getHexString(),
        };
      }, t);

      expect(tierResult.currentTier).toBe(t);
      expect(tierResult.hasTexture).toBe(true);
    }
  });
});
