import { expect, test } from '@playwright/test';

test('closet exposes every clothing category and jumps to its styles', async ({ page }) => {
  await page.goto('/');
  await page.locator('#title-start:not([disabled])').click();
  await page.locator('#rail-toggle').click();
  await page.locator('#btn-closet').click();

  const categories = page.locator('.closet-shop-nav');
  await expect(page.locator('.closet-shop-intro')).toContainText('Shop your whole outfit');
  for (const slot of ['hat', 'jacket', 'pants', 'shoes']) {
    await expect(categories.locator(`button[data-slot="${slot}"]`)).toBeInViewport();
  }
  if (process.env.CLOSET_DISCOVERY_SCREENSHOT) {
    await page.locator('.modal').screenshot({ path: process.env.CLOSET_DISCOVERY_SCREENSHOT.replace(/\.png$/, `-${test.info().project.name}.png`) });
  }

  await categories.locator('button[data-slot="pants"]').click();
  await expect(page.locator('#closet-collection')).toContainText('Cargo Pants');
  await expect(page.locator('#closet-collection .closet-card')).toHaveCount(11);
  await expect(categories.locator('button[data-slot="pants"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(categories.locator('button[data-slot="shoes"]')).toBeInViewport();
  expect(await page.locator('.modal-body').evaluate((body) => body.scrollTop)).toBeGreaterThan(100);

  await categories.locator('button[data-slot="shoes"]').click();
  await expect(page.locator('#closet-collection')).toContainText('Golden High-Roller Boots');
  await expect(page.locator('#closet-collection .closet-card')).toHaveCount(11);
  await page.locator('.closet-shop-intro button[data-slot="all"]').click();
  await expect(page.locator('#closet-collection .closet-card')).toHaveCount(52);
});
