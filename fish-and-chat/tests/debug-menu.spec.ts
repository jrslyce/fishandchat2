import { expect, test } from '@playwright/test';

test.describe('Debug Menu: Wipe User Data and Level Slider', () => {
  test('wipe user data starts fresh, and level slider updates player level and themes', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
    await page.locator('#title-start').click();
    await expect(page.locator('#title-screen')).toBeHidden();

    // 1. Give player custom progress to verify wipe later
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.addCoins(777);
      game.economy.addToBasket({
        catchId: 'sunny-perch',
        isTrash: false,
        weightKg: 0.5,
        caughtAt: Date.now(),
      });
      game.economy.setLevel(14);
    });

    // Verify progress applied
    await expect(page.locator('#hud-level')).toHaveText('Lv 14');
    await expect(page.locator('#hud-coins')).toHaveText('827'); // 50 starting + 777

    // 2. Open Debug modal via the top-left debug button
    await page.locator('#btn-debug').click();
    await expect(page.locator('#modal-host')).toBeVisible();

    // Check that Wipe User Data and Player Level are at the top of the debug list
    const firstRow = page.locator('#modal-host .modal-list li.row').nth(0);
    const secondRow = page.locator('#modal-host .modal-list li.row').nth(1);

    await expect(firstRow).toContainText('Wipe User Data');
    await expect(secondRow).toContainText('Player Level');

    const wipeBtn = page.locator('#modal-host button[data-action="debug-wipe-user-data"]');
    await expect(wipeBtn).toBeVisible();
    await expect(wipeBtn).toHaveText('Wipe Data');

    const levelSlider = page.locator('#debug-level-slider');
    await expect(levelSlider).toBeVisible();
    await expect(levelSlider).toHaveValue('14');
    const levelBadge = page.locator('#debug-level-val');
    await expect(levelBadge).toHaveText('Lv 14');

    // Take screenshot of debug menu with wipe control and level slider
    const debugMenuShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/debug_menu_wipe_and_level_slider.png',
    });
    await testInfo.attach('debug-menu-wipe-and-level-slider', {
      body: debugMenuShot,
      contentType: 'image/png',
    });

    // 3. Test two-step wipe confirmation
    // First click: arms the button
    await wipeBtn.click();
    await expect(wipeBtn).toHaveText('⚠️ Confirm Wipe!');
    await expect(wipeBtn).toHaveClass(/btn-danger/);

    // Take screenshot of armed wipe button
    const armedWipeShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/debug_wipe_data_armed.png',
    });
    await testInfo.attach('debug-wipe-data-armed', {
      body: armedWipeShot,
      contentType: 'image/png',
    });

    // Disarm test: close modal and reopen -> should be disarmed
    await page.locator('#modal-host button[data-action="close"]').click();
    await expect(page.locator('#modal-host')).toBeHidden();

    await page.locator('#btn-debug').click();
    await expect(page.locator('#modal-host')).toBeVisible();
    await expect(wipeBtn).toHaveText('Wipe Data');

    // Arm again and execute wipe (causes window.location.reload)
    await wipeBtn.click();
    await expect(wipeBtn).toHaveText('⚠️ Confirm Wipe!');

    await Promise.all([
      page.waitForNavigation(),
      wipeBtn.click(),
    ]);

    // After reload, user is back at fresh title screen
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
    await expect(page.locator('#title-screen')).toBeVisible();
    await page.locator('#title-start').click();
    await expect(page.locator('#title-screen')).toBeHidden();

    // Verify completely fresh state: Level 1, 50 coins, empty basket
    await expect(page.locator('#hud-level')).toHaveText('Lv 1');
    await expect(page.locator('#hud-coins')).toHaveText('50');
    await expect(page.locator('#hud-basket-count')).toHaveText('0/8');

    const freshState = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return {
        coins: game.economy.snapshot.coins,
        level: game.economy.snapshot.level,
        basketLength: game.economy.snapshot.basket.length,
        theme: game.themeManager.theme,
      };
    });
    expect(freshState.coins).toBe(50);
    expect(freshState.level).toBe(1);
    expect(freshState.basketLength).toBe(0);
    expect(freshState.theme).toBe('forest-pond');

    // 4. Test Level Slider and Theme updates
    await page.locator('#btn-debug').click();
    await expect(page.locator('#modal-host')).toBeVisible();

    const slider = page.locator('#debug-level-slider');
    const badge = page.locator('#debug-level-val');

    await expect(slider).toHaveValue('1');
    await expect(badge).toHaveText('Lv 1');

    // Move slider to level 10 (Ocean Trench theme)
    await slider.fill('10');
    await slider.dispatchEvent('input');
    await expect(badge).toHaveText('Lv 10');
    await expect(page.locator('#hud-level')).toHaveText('Lv 10');

    let theme = await page.evaluate(() => (window as any).__FISH_GAME__.themeManager.theme);
    expect(theme).toBe('ocean-trench');

    // Move slider to level 20 (Cosmic Lake theme)
    await slider.fill('20');
    await slider.dispatchEvent('input');
    await expect(badge).toHaveText('Lv 20');
    await expect(page.locator('#hud-level')).toHaveText('Lv 20');

    theme = await page.evaluate(() => (window as any).__FISH_GAME__.themeManager.theme);
    expect(theme).toBe('cosmic-lake');

    // Test quick preset jump button: jump back to Lv 1 (Pond)
    const pondPreset = page.locator('#modal-host button[data-level-jump="1"]');
    await pondPreset.click();
    await expect(badge).toHaveText('Lv 1');
    await expect(slider).toHaveValue('1');
    await expect(page.locator('#hud-level')).toHaveText('Lv 1');

    theme = await page.evaluate(() => (window as any).__FISH_GAME__.themeManager.theme);
    expect(theme).toBe('forest-pond');

    // Test quick preset jump button: jump to Lv 10 (Ocean)
    const oceanPreset = page.locator('#modal-host button[data-level-jump="10"]');
    await oceanPreset.click();
    await expect(badge).toHaveText('Lv 10');
    await expect(slider).toHaveValue('10');
    await expect(page.locator('#hud-level')).toHaveText('Lv 10');

    theme = await page.evaluate(() => (window as any).__FISH_GAME__.themeManager.theme);
    expect(theme).toBe('ocean-trench');

    // Take screenshot of level slider adjusted
    const levelSliderShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/debug_level_slider_ocean.png',
    });
    await testInfo.attach('debug-level-slider-ocean', {
      body: levelSliderShot,
      contentType: 'image/png',
    });
  });
});
