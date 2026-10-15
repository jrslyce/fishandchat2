import { expect, test } from '@playwright/test';

test('bait selection on right rail of fishing screen and shop behavior', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();

  // Wait for initial render and dismiss title screen
  await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
  await page.locator('#title-start').click();
  await expect(page.locator('#title-screen')).toBeHidden();

  // 1. Verify bait bar exists on the normal fishing screen
  const baitBar = page.locator('#hud-bait-bar');
  await expect(baitBar).toBeVisible();

  // Verify all 4 bait types are present with quantities
  const plebBait = page.locator('#hud-bait-btn-pleb-bait');
  const marshmallows = page.locator('#hud-bait-btn-marshmallows');
  const nightcrawlers = page.locator('#hud-bait-btn-nightcrawlers');
  const neonLure = page.locator('#hud-bait-btn-neon-super-lure');

  await expect(plebBait).toBeVisible();
  await expect(marshmallows).toBeVisible();
  await expect(nightcrawlers).toBeVisible();
  await expect(neonLure).toBeVisible();

  // Initially Pleb Bait is equipped/selected; others are unselected/grayed out
  await expect(plebBait).toHaveClass(/\bselected\b/);
  await expect(plebBait).not.toHaveClass(/\bunselected\b/);
  await expect(plebBait.locator('.hud-bait-qty')).toHaveText('∞');

  await expect(marshmallows).toHaveClass(/unselected/);
  await expect(marshmallows).toHaveClass(/empty/);
  await expect(marshmallows.locator('.hud-bait-qty')).toHaveText('0');

  await expect(nightcrawlers).toHaveClass(/unselected/);
  await expect(nightcrawlers).toHaveClass(/empty/);
  await expect(nightcrawlers.locator('.hud-bait-qty')).toHaveText('0');

  await expect(neonLure).toHaveClass(/unselected/);
  await expect(neonLure).toHaveClass(/empty/);
  await expect(neonLure.locator('.hud-bait-qty')).toHaveText('0');

  // Verify bait bar is on the right side of the screen
  const appBox = (await page.locator('#app').boundingBox())!;
  const barBox = (await baitBar.boundingBox())!;
  expect(barBox.x + barBox.width).toBeGreaterThanOrEqual(appBox.x + appBox.width - 20);

  // Capture screenshot of normal fishing screen with bait selector on right side
  const fishingScreenShot = await page.locator('#app').screenshot({
    path: '/Users/jared/.gemini/antigravity-ide/brain/f825baef-bae5-4c6b-b475-dc2bbb69b2d0/fishing_screen_bait_selector.png',
  });
  await testInfo.attach('normal-fishing-screen-bait-bar', {
    body: fishingScreenShot,
    contentType: 'image/png',
  });

  // 2. Clicking a bait that has none available opens up the store
  await marshmallows.click();
  await expect(page.locator('#modal-host')).toBeVisible();
  await expect(page.locator('#modal-host .modal-header h3')).toHaveText('Shop');

  // 3. Verify players will NO LONGER equip bait from the store interface
  const equipButtons = page.locator('#modal-host button[data-action="equip-bait"]');
  await expect(equipButtons).toHaveCount(0);

  // But they CAN still buy bait from the store
  const buyBaitButtons = page.locator('#modal-host button[data-action="buy-bait"]');
  await expect(buyBaitButtons).toHaveCount(3); // marshmallows, nightcrawlers, neon-super-lure

  // Capture screenshot of shop modal showing buy buttons only, no equip buttons
  const shopShot = await page.locator('#app').screenshot({
    path: '/Users/jared/.gemini/antigravity-ide/brain/f825baef-bae5-4c6b-b475-dc2bbb69b2d0/shop_modal_no_equip.png',
  });
  await testInfo.attach('shop-modal-no-equip-buttons', {
    body: shopShot,
    contentType: 'image/png',
  });

  // 4. Give player coins and buy marshmallows
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.economy.addCoins(500);
  });

  const buyMarshmallowsBtn = page.locator('#modal-host button[data-action="buy-bait"][data-id="marshmallows"]');
  await buyMarshmallowsBtn.click();

  // Close the shop modal
  await page.locator('#modal-host .modal-close').click();
  await expect(page.locator('#modal-host')).toBeHidden();

  // 5. Back on normal fishing screen: marshmallows quantity is now updated (10)
  await expect(marshmallows.locator('.hud-bait-qty')).toHaveText('10');
  await expect(marshmallows).not.toHaveClass(/empty/);
  // Still unselected until clicked
  await expect(marshmallows).toHaveClass(/unselected/);

  // 6. Clicking marshmallows now equips it!
  await marshmallows.click();
  await expect(marshmallows).toHaveClass(/\bselected\b/);
  await expect(marshmallows).not.toHaveClass(/\bunselected\b/);
  // Pleb bait is now unselected/grayed out
  await expect(plebBait).toHaveClass(/\bunselected\b/);
  await expect(plebBait).not.toHaveClass(/\bselected\b/);

  // Capture screenshot of marshmallows selected and other baits grayed out
  const marshmallowsShot = await page.locator('#app').screenshot({
    path: '/Users/jared/.gemini/antigravity-ide/brain/f825baef-bae5-4c6b-b475-dc2bbb69b2d0/marshmallows_equipped_screen.png',
  });
  await testInfo.attach('marshmallows-equipped-selection', {
    body: marshmallowsShot,
    contentType: 'image/png',
  });

  // Verify upper right corner has NO bait pill or name
  expect(await page.locator('#hud-bait-pill').count()).toBe(0);
  expect(await page.locator('#hud-bait-name').count()).toBe(0);

  // 7. Clicking pleb bait switches back
  await plebBait.click();
  await expect(plebBait).toHaveClass(/\bselected\b/);
  await expect(plebBait).not.toHaveClass(/\bunselected\b/);
  await expect(marshmallows).toHaveClass(/\bunselected\b/);
  await expect(marshmallows).not.toHaveClass(/\bselected\b/);

  // 8. Verify 3D bobber visuals change based on equipped bait
  const plebBobberModel = await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    return game.bobber.getActiveModelName();
  });
  expect(plebBobberModel).toBe('defaultBobber');

  // Switch to marshmallows -> bobber becomes marshmallowBobber
  await marshmallows.click();
  const marshmallowBobberModel = await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    return game.bobber.getActiveModelName();
  });
  expect(marshmallowBobberModel).toBe('marshmallowBobber');

  // Give nightcrawlers & neon lure in state to test their bobber visuals
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.economy.state.baitInventory['nightcrawlers'] = 10;
    game.economy.state.baitInventory['neon-super-lure'] = 10;
    game.craftingSystem.equipBait('nightcrawlers');
  });
  const nightcrawlerBobberModel = await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    return game.bobber.getActiveModelName();
  });
  expect(nightcrawlerBobberModel).toBe('nightcrawlerBobber');

  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.craftingSystem.equipBait('neon-super-lure');
  });
  const neonBobberModel = await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    return game.bobber.getActiveModelName();
  });
  expect(neonBobberModel).toBe('neonSuperLureBobber');
});
