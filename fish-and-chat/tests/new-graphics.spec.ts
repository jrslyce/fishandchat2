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
    timeout: 15000,
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
    { timeout: 8000 }
  );

  // In celebration, missed, or idle: view mode MUST return to dock view (circle removed)
  await expect(page.locator('#game-canvas')).not.toHaveClass(/bobber-view/);
  await expect(page.locator('#bobber-circle-ring')).not.toHaveClass(/active/);

  expect(consoleErrors).toEqual([]);
});
