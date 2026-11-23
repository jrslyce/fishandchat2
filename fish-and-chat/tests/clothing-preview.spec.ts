import { expect, test } from '@playwright/test';

test('unowned clothing previews on the live avatar without changing the saved outfit', async ({ page }) => {
  await page.goto('/');
  await page.locator('#title-start:not([disabled])').click();
  await page.locator('#rail-toggle').click();
  await page.locator('#btn-closet').click();

  const skin = () => page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    return (game?.playerCharacter?.player?.skin?.map?.image as HTMLCanvasElement | undefined)?.toDataURL() ?? '';
  });
  await expect.poll(skin).not.toBe('');
  const originalSkin = await skin();
  const originalOutfit = await page.evaluate(() => ({ ...(window as any).__FISH_GAME__.economy.snapshot.equippedClothing }));

  await page.locator('button[data-action="preview-clothing"][data-id="royal-crown"]').click();
  await expect(page.locator('.try-on-detail')).toContainText('Shown on your avatar');
  await expect.poll(skin).not.toBe(originalSkin);
  const whilePreviewing = await page.evaluate(() => {
    const economy = (window as any).__FISH_GAME__.economy;
    return { outfit: { ...economy.snapshot.equippedClothing }, owned: economy.ownsClothing('royal-crown') };
  });
  expect(whilePreviewing.outfit).toEqual(originalOutfit);
  expect(whilePreviewing.owned).toBe(false);

  await page.locator('button[data-action="clear-clothing-preview"]').click();
  await expect.poll(skin).toBe(originalSkin);

  const closetBody = page.locator('#modal-host .modal-body');
  await closetBody.evaluate((body) => { body.scrollTop = body.scrollHeight; });
  expect(await closetBody.evaluate((body) => body.scrollTop)).toBeGreaterThan(0);
  await page.locator('button[data-action="preview-clothing"][data-id="stellar-boots"]').click();
  expect(await closetBody.evaluate((body) => body.scrollTop)).toBe(0);
});
