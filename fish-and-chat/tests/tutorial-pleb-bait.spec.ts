import { expect, test } from '@playwright/test';

test.describe('Pleb bait tutorial flow: 6s & 12s casts, Barnaby dialogue, down triangle, flashing baits, and shop greeting', () => {
  test('full tutorial flow: cast 1 (6s escape), cast 2 (12s escape), Barnaby pleb bait dialogue with flashing triangle, tap to advance, 3 flashing baits, and Barnaby slurplys greeting in shop', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 10);
    await page.locator('#title-start').click();
    await expect(page.locator('#title-screen')).toBeHidden();

    // 1. Verify "Start Tutorial" button exists in Debug modal and resets tutorial state
    await page.locator('#btn-debug').click();
    await expect(page.locator('#modal-host')).toBeVisible();

    const startTutorialBtn = page.locator('button[data-action="debug-start-tutorial"]');
    await expect(startTutorialBtn).toBeVisible();
    await startTutorialBtn.click();
    await expect(page.locator('#modal-host')).toBeHidden();

    // Verify tutorial state is reset to 0 casts and uncompleted
    const stateAfterReset = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return {
        castCount: game.economy.getTutorialCastCount(),
        completed: game.economy.hasCompletedBaitTutorial(),
      };
    });
    expect(stateAfterReset.castCount).toBe(0);
    expect(stateAfterReset.completed).toBe(false);

    // 2. CAST 1: Cast the rod, verify wait duration is 6 seconds, bite escapes
    await page.locator('#game-canvas').click(); // idle -> aiming
    await page.waitForTimeout(150);
    await page.locator('#game-canvas').click(); // aiming -> casting

    // Wait until waiting phase
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'waiting';
    });

    const cast1WaitDuration = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.waitDurationSeconds;
    });
    expect(cast1WaitDuration).toBe(6);

    // Fast-forward phaseElapsed in waiting to trigger bite
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.fishingState.phaseElapsed = 6.0;
    });

    // Wait for bite phase
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'bite';
    });

    // Reel during bite
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.fishingState.manualReelAttempt();
    });

    // Must miss with 'escaped'
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'missed';
    });

    const castCountAfter1 = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.getTutorialCastCount();
    });
    expect(castCountAfter1).toBe(1);

    // Wait for missed phase to end and return to idle
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'idle';
    });

    // 3. CAST 2: Cast the rod, verify wait duration is 12 seconds, bite escapes
    await page.locator('#game-canvas').click(); // idle -> aiming
    await page.waitForTimeout(150);
    await page.locator('#game-canvas').click(); // aiming -> casting

    // Wait until waiting phase
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'waiting';
    });

    const cast2WaitDuration = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.waitDurationSeconds;
    });
    expect(cast2WaitDuration).toBe(12);

    // Fast-forward phaseElapsed in waiting to trigger bite
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.fishingState.phaseElapsed = 12.0;
    });

    // Wait for bite phase
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'bite';
    });

    // Reel during bite
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.fishingState.manualReelAttempt();
    });

    // Must miss with 'escaped'
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'missed';
    });

    const castCountAfter2 = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.getTutorialCastCount();
    });
    expect(castCountAfter2).toBe(2);

    // Wait for missed phase to return to idle
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'idle';
    });

    // 4. Barnaby appears:
    // Speech: "Oh you are using Pleb bait! Won't catch much with those, glurp."
    // Flashing down-pointed triangle flashes to the right.
    const tutorialBubble = page.locator('#tutorial-bubble');
    await expect(tutorialBubble).toBeVisible();

    const bubbleContent = page.locator('#tutorial-bubble-content');
    await expect(bubbleContent).toHaveText("Oh you are using Pleb bait! Won't catch much with those, glurp.");

    const downTriangle = page.locator('#tutorial-down-triangle');
    await expect(downTriangle).toBeVisible();
    await expect(downTriangle).not.toHaveClass(/hidden/);

    // Capture screenshot of Barnaby pleb bait dialogue with flashing triangle
    const step1Shot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/barnaby_pleb_bait_dialogue.png',
    });
    await testInfo.attach('barnaby-pleb-bait-dialogue', {
      body: step1Shot,
      contentType: 'image/png',
    });

    // 5. Tap the screen / bubble to advance dialogue
    await page.locator('#tutorial-bubble-text').click();

    // Speech updates to: "Stop by my ba ba bait shop to get some better ba ba bait."
    await expect(bubbleContent).toHaveText('Stop by my ba ba bait shop to get some better ba ba bait.');
    await expect(downTriangle).toHaveClass(/hidden/);

    // The other 3 baits on the right rail now have a flashing stroke (.tutorial-flash-stroke)
    const marshmallowsBtn = page.locator('#hud-bait-btn-marshmallows');
    const nightcrawlersBtn = page.locator('#hud-bait-btn-nightcrawlers');
    const neonLureBtn = page.locator('#hud-bait-btn-neon-super-lure');
    const plebBaitBtn = page.locator('#hud-bait-btn-pleb-bait');

    await expect(marshmallowsBtn).toHaveClass(/tutorial-flash-stroke/);
    await expect(nightcrawlersBtn).toHaveClass(/tutorial-flash-stroke/);
    await expect(neonLureBtn).toHaveClass(/tutorial-flash-stroke/);
    await expect(plebBaitBtn).not.toHaveClass(/tutorial-flash-stroke/);

    // Capture screenshot of the 3 baits flashing on the right rail
    const step2Shot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/baits_flashing_stroke.png',
    });
    await testInfo.attach('baits-flashing-stroke', {
      body: step2Shot,
      contentType: 'image/png',
    });

    // 6. Click one of the flashing baits to open Barnaby's bait shop
    await marshmallowsBtn.click({ force: true });
    await expect(page.locator('#modal-host')).toBeVisible();

    // Verify Barnaby says: "Glurp, oh hi new one. Grab some slurplys"
    const barnabySpeech = page.locator('#shop-barnaby-banner .shop-barnaby-speech');
    await expect(barnabySpeech).toBeVisible();
    await expect(barnabySpeech).toHaveText('Glurp, oh hi new one. Grab some slurplys');

    const headerBubble = page.locator('#modal-host .barnaby-bubble');
    await expect(headerBubble).toBeVisible();
    await expect(headerBubble).toContainText('Glurp, oh hi new one. Grab some slurplys');

    // Capture screenshot of Barnaby welcoming player in bait shop
    const shopGreetingShot = await page.locator('#app').screenshot({
      path: '/Users/jared/.gemini/antigravity-ide/brain/a0b52fda-756c-4c09-b118-cac3e6161ede/shop_barnaby_slurplys_greeting.png',
    });
    await testInfo.attach('shop-barnaby-slurplys-greeting', {
      body: shopGreetingShot,
      contentType: 'image/png',
    });

    // Verify tutorial is now marked completed
    const completedState = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.hasCompletedBaitTutorial();
    });
    expect(completedState).toBe(true);

    // 7. Close shop and verify normal game proceeds
    await page.locator('#modal-host .modal-close').click();
    await expect(page.locator('#modal-host')).toBeHidden();

    // Flashing stroke is removed from all baits
    await expect(marshmallowsBtn).not.toHaveClass(/tutorial-flash-stroke/);
    await expect(nightcrawlersBtn).not.toHaveClass(/tutorial-flash-stroke/);
    await expect(neonLureBtn).not.toHaveClass(/tutorial-flash-stroke/);

    // Tutorial bubble is dismissed
    await expect(tutorialBubble).toBeHidden();

    // Player can now cast normally and normal game proceeds
    await page.waitForTimeout(200);
    await page.locator('#game-canvas').click();
    await page.waitForFunction(() => {
      const game = (window as any).__FISH_GAME__;
      return game.fishingState.getPhase() === 'aiming';
    });
  });
});
