import { test, expect } from '@playwright/test';

test.describe('Underwater fish shadow: ambient swimming, pre-bite stalking, and bite strike', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
    const titleStart = page.locator('#title-start');
    if (await titleStart.isVisible()) {
      await titleStart.click();
      await expect(page.locator('#title-screen')).toBeHidden();
    }
    // Ensure tutorial / fresh state for predictable wait timing
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      if (game) {
        game.economy.resetTutorial();
        game.economy.persist();
      }
    });
  });

  test('fish shadow appears, curves in to stalk bait before a bite, and fights during bite', async ({ page }, testInfo) => {
    // 1. Cast line (starts tutorial cast 1: 6 seconds wait time)
    await page.locator('#game-canvas').click(); // idle -> aiming
    await page.waitForTimeout(200);
    await page.locator('#game-canvas').click(); // aiming -> casting

    // Wait until waiting phase begins
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const game = (window as any).__FISH_GAME__;
        return game ? game.fishingState.getPhase() : null;
      });
    }, { timeout: 4000 }).toBe('waiting');

    // 2. Early in the wait (remaining > 2.5s), verify the pre-bite stalker is not yet active
    const earlyState = await page.evaluate(() => {
      const system = (window as any).__FISH_SHADOW_SYSTEM__;
      return system ? system.getState() : null;
    });
    expect(earlyState === 'idle' || earlyState === 'ambient_swimming').toBe(true);

    // 3. As waitRemaining reaches <= 2.4s (around 3.6s into the 6s cast),
    // verify the fish shadow starts stalking the bait
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const game = (window as any).__FISH_GAME__;
        const system = (window as any).__FISH_SHADOW_SYSTEM__;
        const remaining = game.fishingState.getRemainingWaitSeconds();
        const isVisible = system ? system.isFishVisible() : false;
        const state = system ? system.getState() : null;
        return { remaining, isVisible, state };
      });
    }, { timeout: 10000 }).toMatchObject({
      isVisible: true,
      state: 'stalking_bite',
    });

    // 4. Wait until stalking fish has curved close to bobber (dist < 0.16) in open water
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const game = (window as any).__FISH_GAME__;
        const system = (window as any).__FISH_SHADOW_SYSTEM__;
        if (!system || !system.isFishVisible()) return false;
        const bPos = game.bobber.getWorldPosition();
        const fPos = system.getFishPosition();
        const dist = Math.hypot(fPos.x - bPos.x, fPos.z - bPos.z);
        return dist < 0.16 && fPos.z >= bPos.z - 0.02;
      });
    }, { timeout: 4000 }).toBe(true);

    // Capture screenshot of the fish shadow stalking the bobber in the water
    const stalkShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/fish_shadow_stalking_bobber.png',
    });
    await testInfo.attach('fish-shadow-stalking-bobber', {
      body: stalkShot,
      contentType: 'image/png',
    });

    // 5. Right before the bite (< 0.5s remaining), verify fish has closed in near the bobber
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const game = (window as any).__FISH_GAME__;
        const system = (window as any).__FISH_SHADOW_SYSTEM__;
        const remaining = game.fishingState.getRemainingWaitSeconds();
        if (remaining > 0.6) return false;
        const bPos = game.bobber.getWorldPosition();
        const fPos = system.getFishPosition();
        const dx = fPos.x - bPos.x;
        const dz = fPos.z - bPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        return dist < 0.14; // fish is lunging right at the bobber
      });
    }, { timeout: 4000 }).toBe(true);

    // 6. When bite phase begins, verify fish state is 'fighting_bite'
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const game = (window as any).__FISH_GAME__;
        const system = (window as any).__FISH_SHADOW_SYSTEM__;
        return {
          phase: game.fishingState.getPhase(),
          fishState: system.getState(),
          fishVisible: system.isFishVisible(),
        };
      });
    }, { timeout: 4000 }).toMatchObject({
      phase: 'bite',
      fishState: 'fighting_bite',
      fishVisible: true,
    });

    // Capture screenshot of fish shadow fighting during bite
    const biteShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/fish_shadow_fighting_bite.png',
    });
    await testInfo.attach('fish-shadow-fighting-bite', {
      body: biteShot,
      contentType: 'image/png',
    });
  });

  test('fish shadow darts away when player reels in early', async ({ page }, testInfo) => {
    // Start cast 2 (12s wait time in tutorial, plenty of time for ambient fish)
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.setTutorialCastCount(1); // cast 2 has 12s wait
      game.economy.persist();
    });

    await page.locator('#game-canvas').click(); // idle -> aiming
    await page.waitForTimeout(200);
    await page.locator('#game-canvas').click(); // aiming -> casting

    // Wait until waiting phase begins
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const game = (window as any).__FISH_GAME__;
        return game ? game.fishingState.getPhase() : null;
      });
    }, { timeout: 4000 }).toBe('waiting');

    // Wait for an ambient fish to curve close to the bobber (dist < 0.28)
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const game = (window as any).__FISH_GAME__;
        const system = (window as any).__FISH_SHADOW_SYSTEM__;
        if (!system || !system.isFishVisible()) return false;
        const bPos = game.bobber.getWorldPosition();
        const fPos = system.getFishPosition();
        const dist = Math.hypot(fPos.x - bPos.x, fPos.z - bPos.z);
        return dist < 0.28;
      });
    }, { timeout: 10000 }).toBe(true);

    // Capture screenshot of ambient fish swimming around
    const ambientShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/fish_shadow_ambient_swimming.png',
    });
    await testInfo.attach('fish-shadow-ambient-swimming', {
      body: ambientShot,
      contentType: 'image/png',
    });

    // Reel in early by clicking canvas
    await page.locator('#game-canvas').click();

    // Verify fish state transitions to fleeing or idle
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const system = (window as any).__FISH_SHADOW_SYSTEM__;
        return system ? system.getState() : null;
      });
    }, { timeout: 3000 }).toMatch(/^(fleeing|idle)$/);

    // Shortly after fleeing, fish becomes hidden
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const system = (window as any).__FISH_SHADOW_SYSTEM__;
        return system ? system.isFishVisible() : false;
      });
    }, { timeout: 3000 }).toBe(false);
  });
});
