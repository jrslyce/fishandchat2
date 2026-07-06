import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

type CanvasSample = {
  ok: boolean;
  reason: string;
  variance?: number;
  colorBuckets?: number;
};

async function sampleCanvas(page: import('@playwright/test').Page): Promise<CanvasSample> {
  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  if (!box || box.width < 32 || box.height < 32) {
    return { ok: false, reason: 'canvas-too-small' };
  }

  const buffer = await canvas.screenshot();
  const png = PNG.sync.read(buffer);
  let min = 255;
  let max = 0;
  let alphaPixels = 0;
  const buckets = new Set<string>();
  const stride = Math.max(1, Math.floor((png.width * png.height) / 4096));

  for (let pixel = 0; pixel < png.width * png.height; pixel += stride) {
    const offset = pixel * 4;
    const r = png.data[offset];
    const g = png.data[offset + 1];
    const b = png.data[offset + 2];
    const a = png.data[offset + 3];
    min = Math.min(min, r, g, b);
    max = Math.max(max, r, g, b);
    if (a > 0) alphaPixels += 1;
    buckets.add(`${r >> 4},${g >> 4},${b >> 4},${a >> 6}`);
  }

  const variance = max - min;
  return {
    ok: alphaPixels > 256 && (variance > 8 || buckets.size > 3),
    reason: 'sampled',
    variance,
    colorBuckets: buckets.size,
  };
}

async function tap(page: import('@playwright/test').Page, pointerId: number) {
  const button = page.locator('#action-button');
  await button.dispatchEvent('pointerdown', { pointerId, button: 0 });
  await button.dispatchEvent('pointerup', { pointerId, button: 0 });
}

test('renders a nonblank pond diorama and plays the cast -> wait loop', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10);

  const sample = await sampleCanvas(page);
  expect(sample, JSON.stringify(sample)).toMatchObject({ ok: true });

  // Dismiss the title screen (it visually covers the action button until this fires).
  await page.locator('#title-start').click();
  await expect(page.locator('#title-screen')).toBeHidden();

  // Tap 1: idle -> aiming (cast gauge appears).
  await tap(page, 1);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'aiming');

  // Tap 2: lock the gauge -> casting -> waiting (automatic after the cast animation).
  await page.waitForTimeout(200);
  await tap(page, 2);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'waiting', undefined, {
    timeout: 5000,
  });

  await expect(page.locator('#hud-coins')).toBeVisible();
  await expect(page.locator('#phase-indicator .progress-track')).toBeVisible();

  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${testInfo.project.name}-game`, {
    body: screenshot,
    contentType: 'image/png',
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
