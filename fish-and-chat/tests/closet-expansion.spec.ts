import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CLOTHING_CATALOG, PREMIUM_CATALOG } from '../src/game/data';

test('twenty new clothing looks have assets and the candy prices share the premium catalog', () => {
  const added = CLOTHING_CATALOG.filter((item) => item.isNew);
  expect(added).toHaveLength(20);
  expect(added.filter((item) => item.unlock.type === 'premium')).toHaveLength(8);
  for (const item of added) {
    for (const texture of Object.values(item.textures)) {
      expect(existsSync(join(process.cwd(), 'public', texture!.replace(/^\.\//, ''))), `${item.id}: ${texture}`).toBe(true);
    }
    if (item.unlock.type === 'premium') {
      const premiumId = item.unlock.premiumId;
      expect(PREMIUM_CATALOG.find((premium) => premium.id === premiumId)?.costCandyBars).toBeGreaterThan(0);
    }
  }
});

test('Closet puts the rod preview first and supports candy clothing from try-on', async ({ page }) => {
  await page.goto('/');
  await page.locator('#title-start:not([disabled])').click();
  await page.locator('#rail-toggle').click();
  await page.locator('#btn-closet').click();

  expect(await page.locator('.modal-body > :first-child').getAttribute('class')).toContain('closet-preview-frame');
  expect(await page.evaluate(() => (window as any).__FISH_GAME__.closetCharacter.pole.visible)).toBe(true);
  if (process.env.CLOSET_EXPANSION_SCREENSHOT) await page.locator('.modal').screenshot({ path: process.env.CLOSET_EXPANSION_SCREENSHOT });

  await page.evaluate(() => {
    const game = (window as any).__FISH_GAME__;
    game.economy.addCandyBars(50);
    game.events.emit('candyBarsChanged', {});
  });
  await expect(page.locator('.closet-wallet-strip')).toContainText('50');
  await page.locator('button[data-action="preview-clothing"][data-id="disco-crown"]').click();
  await expect(page.locator('.try-on-detail')).toContainText('35 🍫');
  await page.locator('.try-on-detail button[data-action="buy-clothing"]').click();
  await expect(page.locator('.closet-wallet-strip')).toContainText('15');
  expect(await page.evaluate(() => {
    const economy = (window as any).__FISH_GAME__.economy;
    return [economy.ownsClothing('disco-crown'), economy.equippedClothing().hat];
  })).toEqual([true, 'disco-crown']);

  await page.locator('button[data-action="preview-clothing"][data-id="aurora-helmet"]').click();
  await page.locator('.try-on-detail button[data-action="open-candy-shop-from-closet"]').click();
  await expect(page.locator('.modal-header')).toContainText('Candy Bar Shop');
  await page.locator('button[data-action="return-to-closet"]').click();
  await expect(page.locator('.try-on-detail')).toContainText('Aurora Helmet');

  await page.locator('button[data-action="filter-closet-browse"][data-id="new"]').click();
  await expect(page.locator('#closet-collection .closet-card')).toHaveCount(20);
  await page.locator('#closet-search').fill('comet');
  await page.locator('button[data-action="search-closet"]').click();
  await expect(page.locator('#closet-collection .closet-card')).toHaveCount(1);
  await expect(page.locator('#closet-collection')).toContainText('Comet Skates');
});

test('new looks from all four slots appear on the portrait', async ({ page }) => {
  await page.goto('/');
  await page.locator('#title-start:not([disabled])').click();
  await page.locator('#rail-toggle').click();
  await page.locator('#btn-closet').click();
  for (const [id, name, anchor] of [
    ['sunflower-bucket-hat', 'Sunflower Bucket Hat', 'head'],
    ['neon-arcade-jacket', 'Neon Arcade Jacket', 'body'],
    ['hologram-trousers', 'Hologram Trousers', 'leftLeg'],
    ['comet-skates', 'Comet Skates', 'leftLeg'],
  ]) {
    await page.locator(`button[data-action="preview-clothing"][data-id="${id}"]`).click();
    await expect(page.locator('.try-on-detail')).toContainText(name);
    await expect.poll(() => page.evaluate((part) => {
      const game = (window as any).__FISH_GAME__;
      return game.closetCharacter.accessories.some(({ anchor, group }: any) => anchor === part && group.children.length > 0);
    }, anchor)).toBe(true);
    if (process.env.CLOSET_LOOKS_SCREENSHOT) {
      await page.locator('.modal').screenshot({ path: process.env.CLOSET_LOOKS_SCREENSHOT.replace(/\.png$/, `-${id}.png`) });
    }
  }
});
