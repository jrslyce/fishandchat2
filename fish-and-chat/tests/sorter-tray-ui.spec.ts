import { expect, test } from '@playwright/test';

test('Sorter Tray unlock updates the open market immediately', async ({ page }) => {
  await page.goto('/');
  await page.locator('#title-start').waitFor({ state: 'visible' });
  const save = await page.evaluate(async () => {
    const { createDefaultSaveState } = await import(String('/src/game/SaveState.ts'));
    const state = createDefaultSaveState();
    state.coins = 1000;
    state.materials.metal = 4;
    return state;
  });
  await page.evaluate((state) => {
    localStorage.setItem('fish-and-chat-save-v1', JSON.stringify({ version: 3, savedAt: Date.now(), state }));
  }, save);
  await page.reload();
  await page.locator('#title-start:not([disabled])').click();
  await page.locator('#rail-toggle').click();
  await page.locator('#btn-market').click();

  await expect(page.locator('#modal-host')).toContainText('You have 1000🪙 and 4 metal');
  await page.getByRole('button', { name: 'Unlock Sorter Tray' }).click();
  await expect(page.getByRole('button', { name: 'Auto sell common: On' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Auto sell uncommon: On' })).toBeVisible();
  await page.getByRole('button', { name: 'Auto sell uncommon: On' }).click();
  await expect(page.getByRole('button', { name: 'Auto sell uncommon: Off' })).toBeVisible();
  await expect(page.locator('#hud-coins-pill')).toContainText('100');
});
