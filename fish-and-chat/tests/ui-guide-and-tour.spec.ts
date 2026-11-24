import { test, expect } from '@playwright/test';

test.describe('UI Guide & Interactive Tour', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 318, height: 496 });
    await page.goto('/?debug=1');
    await expect(page.locator('#title-start')).toBeEnabled({ timeout: 15000 });
    await page.locator('#title-start').click();
    await expect(page.locator('#title-screen')).toBeHidden({ timeout: 10000 });
  });

  test('Guide modal explains Anchor Boss Raid, Menu, and all 9 sections', async ({ page }) => {
    await page.locator('#btn-quick-guide').click();
    const modal = page.locator('#modal-host .modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('How to Play & UI Guide');
    await expect(modal).toContainText('Anchor Pill (Channel Boss Raid)');
    await expect(modal).toContainText('Opening the Menu (☰) & Sections');
    await expect(modal).toContainText('Story & Quests');
    await expect(modal).toContainText('Shop');
    await expect(modal).toContainText('Market');
    await expect(modal).toContainText('Crafting Bench');
    await expect(modal).toContainText('Candy Bar Shop');
    await expect(modal).toContainText('Closet');
    await expect(modal).toContainText('Scrap Book');
    await expect(modal).toContainText('Skills');
    await expect(modal).toContainText('Settings');

    // Launch Interactive UI Tour from the Guide modal
    await page.locator('#btn-start-ui-tour').click();
    await expect(page.locator('#modal-host')).toBeHidden();

    // Step 1: Anchor Pill highlighted
    await expect(page.locator('#tutorial-bubble-content')).toContainText('(1/7) Anchor (⚓)');
    await expect(page.locator('#hud-community-pill')).toHaveClass(/tutorial-flash-stroke/);

    // Step 2: Top Bar
    await page.locator('#tutorial-bubble-text').click();
    await expect(page.locator('#tutorial-bubble-content')).toContainText('(2/7) Top Bar');

    // Step 3: Menu Button
    await page.locator('#tutorial-bubble-text').click();
    await expect(page.locator('#tutorial-bubble-content')).toContainText('(3/7) Tap ☰ Menu');

    // Step 4: Economy & Gear (rail auto-expands)
    await page.locator('#tutorial-bubble-text').click();
    await expect(page.locator('#tutorial-bubble-content')).toContainText('(4/7) Economy & Gear');
    await expect(page.locator('#hud-rail-items')).toBeVisible();

    // Step 5: Character & Progress
    await page.locator('#tutorial-bubble-text').click();
    await expect(page.locator('#tutorial-bubble-content')).toContainText('(5/7) Character & Progress');

    // Step 6: Bait Bar (rail auto-collapses)
    await page.locator('#tutorial-bubble-text').click();
    await expect(page.locator('#tutorial-bubble-content')).toContainText('(6/7) Right Bait Bar');
    await expect(page.locator('#hud-rail-items')).toBeHidden();

    // Step 7: Fish Basket
    await page.locator('#tutorial-bubble-text').click();
    await expect(page.locator('#tutorial-bubble-content')).toContainText('(7/7) Bottom-left Fish Basket');

    // Finish tour — highlights cleared
    await page.locator('#tutorial-bubble-text').click();
    await expect(page.locator('.tour-highlight-target')).toHaveCount(0);
  });
});
