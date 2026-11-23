import { expect, test } from '@playwright/test';

test('closet shows the 3D outfit in its portrait studio', async ({ page }) => {
  await page.goto('/');
  await page.locator('#title-start:not([disabled])').click();
  await page.locator('#rail-toggle').click();
  await page.locator('#btn-closet').click();

  await page.locator('button[data-action="preview-clothing"][data-id="straw-hat"]').click();
  await expect(page.locator('.try-on-detail')).toContainText('Straw Hat');
  await expect.poll(() => page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    return game.closetCharacter.accessories.some(({ anchor, group }: any) => anchor === 'head' && group.children.length >= 3);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const skinCanvas = (window as any).__FISH_GAME__.closetCharacter.player.skin.map.image as HTMLCanvasElement;
    const ctx = skinCanvas.getContext('2d')!;
    return `${ctx.getImageData(40, 8, 1, 1).data[3]},${ctx.getImageData(40, 10, 1, 1).data[3]}`;
  })).toBe('255,0');
  expect(await page.evaluate(() => (window as any).__FISH_GAME__.closetCharacter.pole.visible)).toBe(true);
  expect(await page.locator('.closet-card-art .clothing-art').count()).toBeGreaterThan(20);

  await expect.poll(() => page.locator('#closet-preview').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!pixels) return 0;
    let colored = 0;
    for (let y = 50; y < 350; y += 8) for (let x = 45; x < 275; x += 8) {
      const i = (y * canvas.width + x) * 4;
      if (Math.abs(pixels[i] - 199) > 28 || Math.abs(pixels[i + 1] - 228) > 28) colored++;
    }
    return colored;
  })).toBeGreaterThan(100);
  if (process.env.CLOSET_SCREENSHOT) await page.locator('.modal').screenshot({ path: process.env.CLOSET_SCREENSHOT });

  const canvas = page.locator('#closet-preview');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Closet portrait is not visible');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 85, bounds.y + bounds.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).__FISH_GAME__.closetTurn)).toBeGreaterThan(0.5);
  if (process.env.CLOSET_SCREENSHOT) {
    await page.locator('.modal-body').evaluate((body) => { body.scrollTop = 900; });
    await page.locator('.modal').screenshot({ path: process.env.CLOSET_SCREENSHOT.replace(/\.png$/, '-cards.png') });
  }
});
