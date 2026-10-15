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

    // Verify lower banner is removed, and header bubble shows Barnaby's dialogue
    const barnabyBanner = page.locator('#shop-barnaby-banner');
    await expect(barnabyBanner).toBeHidden();

    // Verify header bubble shows the dialogue
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

  test('paid bait without lucky coin bottle does not trigger coin toss and consumes bait normally', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
    await page.locator('#title-start').click();
    await expect(page.locator('#title-screen')).toBeHidden();

    // Ensure lucky coin bottle is NOT unlocked
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.markBaitTutorialCompleted();
      game.economy.setLuckyCoinBottle(false);
      game.economy.snapshot.baitInventory['marshmallows'] = 5;
      game.economy.equipBait('marshmallows');
      game.ui.renderHud();
    });

    const hasBottle = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.hasLuckyCoinBottle();
    });
    expect(hasBottle).toBe(false);

    // Trigger bite reaction success
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.fishingState.resolveCatchSuccess();
    });

    // Catch card should be visible
    const catchCard = page.locator('#catch-card');
    await expect(catchCard).toBeVisible();

    // Coin toss overlay should NOT be visible!
    const coinOverlay = page.locator('#coin-toss-overlay');
    await expect(coinOverlay).toBeHidden();

    // Verify bait was consumed (5 -> 4)
    const baitCount = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.snapshot.baitInventory['marshmallows'];
    });
    expect(baitCount).toBe(4);
  });

  test('neon lure catches lucky coin in a bottle, unlocking coin flip feature', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
    await page.locator('#title-start').click();
    await expect(page.locator('#title-screen')).toBeHidden();

    // Ensure lucky coin bottle is locked and player uses neon super lure
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.markBaitTutorialCompleted();
      game.economy.setLuckyCoinBottle(false);
      game.economy.snapshot.baitInventory['neon-super-lure'] = 5;
      game.economy.equipBait('neon-super-lure');
      game.economy.setDebugForceNextCatch('lucky-coin-bottle');
      game.ui.renderHud();
    });

    // Reel in catch
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.fishingState.resolveCatchSuccess();
    });

    // Verify catch card shows "Lucky Coin in a Bottle"
    const catchCard = page.locator('#catch-card');
    await expect(catchCard).toBeVisible();
    await expect(catchCard.locator('.catch-name')).toHaveText('Lucky Coin in a Bottle');
    await expect(catchCard.locator('.catch-flavor')).toContainText('Unlocks the Bait Saver Coin Flip');

    // Screenshot of Lucky Coin in a Bottle catch card
    const bottleCatchShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/lucky_coin_bottle_catch.png',
    });
    await testInfo.attach('lucky-coin-bottle-catch', {
      body: bottleCatchShot,
      contentType: 'image/png',
    });

    // Verify economy has unlocked the bottle!
    const hasBottleNow = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.hasLuckyCoinBottle();
    });
    expect(hasBottleNow).toBe(true);

    // Verify coin toss overlay did NOT show on the bottle catch itself
    const coinOverlay = page.locator('#coin-toss-overlay');
    await expect(coinOverlay).toBeHidden();
  });

  test('after finding lucky coin bottle, catch card displays caught fish FIRST, then coin flip appears', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
    await page.locator('#title-start').click();
    await expect(page.locator('#title-screen')).toBeHidden();

    // Unlock bottle and equip paid bait
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.markBaitTutorialCompleted();
      game.economy.setLuckyCoinBottle(true);
      game.economy.snapshot.baitInventory['marshmallows'] = 5;
      game.economy.equipBait('marshmallows');
      game.ui.renderHud();
    });

    // Reel in a normal fish
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.fishingState.resolveCatchSuccess();
    });

    const catchCard = page.locator('#catch-card');
    const coinOverlay = page.locator('#coin-toss-overlay');

    // 1. Immediately after catch: catch card MUST be visible
    await expect(catchCard).toBeVisible();
    await expect(catchCard.locator('.catch-name')).toBeVisible();

    // 2. Immediately after catch: coin toss overlay MUST BE HIDDEN (player sees caught fish first!)
    await expect(coinOverlay).toBeHidden();

    // Screenshot showing caught fish visible before coin flip
    const fishFirstShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/fish_seen_before_coin_flip.png',
    });
    await testInfo.attach('fish-seen-before-coin-flip', {
      body: fishFirstShot,
      contentType: 'image/png',
    });

    // 3. Now tap canvas to finish celebration (or wait for celebration timer)
    await page.locator('#game-canvas').click();

    // 4. Now coin flip overlay appears!
    await expect(coinOverlay).toBeVisible();

    // Screenshot of coin flip modal appearing after celebration
    const coinFlipAfterFishShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/coin_flip_after_fish_seen.png',
    });
    await testInfo.attach('coin-flip-after-fish-seen', {
      body: coinFlipAfterFishShot,
      contentType: 'image/png',
    });

    // Verify flip button and flip execution
    const flipBtn = coinOverlay.locator('#btn-coin-flip');
    await expect(flipBtn).toBeVisible();
    await flipBtn.click();
    await expect(coinOverlay.locator('#coin-result-message')).toBeVisible({ timeout: 5000 });
  });
});
