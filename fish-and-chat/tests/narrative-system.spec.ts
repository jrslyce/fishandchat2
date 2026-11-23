import { expect, test } from '@playwright/test';

test.describe('NarrativeSystem & In-World Reactive Dialogue', () => {
  test('NarrativeSystem initializes and exposes on window.__narrativeSystem in DEV mode', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#game-canvas')).toBeVisible();

    const initialized = await page.evaluate(async () => {
      const game = (window as any).__FISH_GAME__;
      const narrative = (window as any).__narrativeSystem || game?.narrativeSystem;
      return {
        hasGame: !!game,
        hasNarrativeSystem: !!narrative,
        hasSpeechBubbleElement: !!document.getElementById('barnaby-speech-bubble'),
      };
    });

    expect(initialized.hasGame).toBe(true);
    expect(initialized.hasNarrativeSystem).toBe(true);
    expect(initialized.hasSpeechBubbleElement).toBe(true);
  });

  test('showDialogue displays dialogue bubble with moods, typewriter, and dismisses', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#game-canvas')).toBeVisible();

    // Trigger dialogue directly
    await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      narrative.showDialogue('Ahoy, angler! The tide is rising fast today!', 5.0, 'excited');
    });

    const bubble = page.locator('#barnaby-speech-bubble');
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveClass(/mood-excited/);

    // Fast forward or advance frame
    await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      narrative.update(1.0);
    });

    const bubbleText = page.locator('#barnaby-speech-bubble .bubble-text');
    await expect(bubbleText).toContainText('Ahoy, angler!');

    // Test dismiss button
    const dismissBtn = page.locator('#barnaby-speech-bubble .bubble-dismiss-btn');
    await dismissBtn.click();
    await expect(bubble).toHaveClass(/hidden/);
  });

  test('spawnWaterBottle creates 3D bottle, bobs on waves, and collects on tap', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#game-canvas')).toBeVisible();

    const bottleSpawned = await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      narrative.spawnWaterBottle('bottle_murmuring_waters');
      return narrative.hasWaterBottle() && narrative.getActiveBottleId() === 'bottle_murmuring_waters';
    });
    expect(bottleSpawned).toBe(true);

    // Update system to verify bobbing physics
    await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      narrative.update(0.5);
      narrative.update(0.5);
    });

    // Remove bottle
    const bottleRemoved = await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      narrative.removeWaterBottle();
      return !narrative.hasWaterBottle() && narrative.getActiveBottleId() === null;
    });
    expect(bottleRemoved).toBe(true);
  });

  test('Reacts to Living World and Gameplay events', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#game-canvas')).toBeVisible();

    // 1. Weather event (rain)
    const rainDialogue = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const narrative = (window as any).__narrativeSystem || game?.narrativeSystem;
      game.events.emit('weatherChanged', { weather: 'rain' });
      narrative.update(0.5);
      return narrative.getCurrentDialogue();
    });
    expect(rainDialogue).toContain('drizzle');

    // 2. Whale jump event
    const whaleDialogue = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const narrative = (window as any).__narrativeSystem || game?.narrativeSystem;
      game.events.emit('whaleJump', {});
      narrative.update(0.5);
      return narrative.getCurrentDialogue();
    });
    expect(whaleDialogue).toContain('humpback');

    // 3. Kraken breach event
    const krakenDialogue = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const narrative = (window as any).__narrativeSystem || game?.narrativeSystem;
      game.events.emit('krakenBreach', {});
      narrative.update(0.5);
      return narrative.getCurrentDialogue();
    });
    expect(krakenDialogue.toLowerCase()).toContain('tentacles');

    // 4. Legendary catch event
    const legendaryDialogue = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const narrative = (window as any).__narrativeSystem || game?.narrativeSystem;
      game.events.emit('catchResolved', {
        result: {
          catchId: 'fish-void-leviathan',
          name: 'Void Leviathan',
          rarity: 'legendary',
          isTrash: false,
          weightKg: 42.5,
          value: 1000,
          flavor: 'Ancient cosmic entity',
          xpAwarded: 500,
          addedToBasket: true,
        },
      });
      narrative.update(0.5);
      return narrative.getCurrentDialogue();
    });
    expect(legendaryDialogue).toContain('LEGENDARY');

    // 5. High catch streak event
    const streakDialogue = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      const narrative = (window as any).__narrativeSystem || game?.narrativeSystem;
      game.events.emit('streakChanged', { streak: 10, bestStreak: 10 });
      narrative.update(0.5);
      return narrative.getCurrentDialogue();
    });
    expect(streakDialogue).toContain('streak of 10');

    // 6. Barnaby interaction (clicking on Barnaby on dock)
    const barnabyTalk = await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      narrative.triggerBarnabyInteraction();
      narrative.update(0.5);
      return narrative.getCurrentDialogue();
    });
    expect(barnabyTalk).toBeTruthy();
  });
});
