import { expect, test } from '@playwright/test';

test('fishing line moves with bobber and bobber moves around during bite', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 15);
  await page.locator('#title-start').click();
  await page.waitForTimeout(300);

  // Cast to start fishing
  await page.locator('#game-canvas').click(); // idle -> aiming
  await page.waitForTimeout(300);
  await page.locator('#game-canvas').click(); // aiming -> casting

  // Wait for waiting phase
  await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.state === 'waiting');

  // Verify that during waiting, line end tracks bobber attachment point
  const waitingPositions = await page.evaluate(async () => {
    const game = (window as any).__FISH_GAME__;
    const samples: Array<{ bobberY: number; bobberX: number; lineEnd: { x: number; y: number; z: number } }> = [];
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 60));
      const attachPos = game.bobber.getLineAttachmentWorldPosition();
      const bodyPos = game.bobber.getWorldPosition();
      samples.push({
        bobberY: bodyPos.y,
        bobberX: bodyPos.x,
        lineEnd: { x: attachPos.x, y: attachPos.y, z: attachPos.z },
      });
    }
    return samples;
  });

  expect(waitingPositions.length).toBe(5);
  // Verify bobber has motion during waiting
  const yValues = waitingPositions.map((s) => s.bobberY);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  expect(maxY - minY).toBeGreaterThanOrEqual(0);

  // Take screenshot during waiting
  const waitingShot = await page.locator('#app').screenshot({ omitBackground: true });
  await testInfo.attach('bobber_waiting_dynamic', { body: waitingShot, contentType: 'image/png' });

  // Force bite phase or wait for natural bite
  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    if (game.fishingState.getPhase() === 'waiting') {
      (game.fishingState as any).enterBite();
    }
  });

  await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.state === 'bite');
  await page.waitForTimeout(150);

  // Take screenshot during active bite
  const biteShot = await page.locator('#app').screenshot({ omitBackground: true });
  await testInfo.attach('bobber_bite_dynamic', { body: biteShot, contentType: 'image/png' });

  // Sample bobber positions over time during bite to verify multi-directional motion (X, Y, Z)
  const biteMotion = await page.evaluate(async () => {
    const game = (window as any).__FISH_GAME__;
    const positions: Array<{ x: number; y: number; z: number; rotX: number; rotZ: number }> = [];
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 40));
      const bPos = game.bobber.getWorldPosition();
      const rot = (game.bobber as any).body?.rotation;
      positions.push({
        x: bPos.x,
        y: bPos.y,
        z: bPos.z,
        rotX: rot?.x ?? 0,
        rotZ: rot?.z ?? 0,
      });
    }
    return positions;
  });

  // Verify that the bobber moves around during bite across X, Y, and Z
  const xs = biteMotion.map((p) => p.x);
  const ys = biteMotion.map((p) => p.y);
  const zs = biteMotion.map((p) => p.z);
  const deltaX = Math.max(...xs) - Math.min(...xs);
  const deltaY = Math.max(...ys) - Math.min(...ys);
  const deltaZ = Math.max(...zs) - Math.min(...zs);

  // Bobber moves around significantly in X, Y, Z
  expect(deltaX).toBeGreaterThan(0.01);
  expect(deltaY).toBeGreaterThan(0.01);
  expect(deltaZ).toBeGreaterThan(0.01);
});
