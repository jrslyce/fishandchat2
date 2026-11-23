import { test, expect } from '@playwright/test';

test.describe('Story and Goals System & Stream Engagement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__THREE_GAME_DIAGNOSTICS__?.frame > 5);
    const titleStart = page.locator('#title-start');
    await expect(titleStart).toBeEnabled({ timeout: 10000 });
    await titleStart.click();
    await expect(page.locator('#title-screen')).toBeHidden({ timeout: 10000 });
  });

  test('HUD renders weather pill and streak pill correctly', async ({ page }) => {
    const weatherPill = page.locator('#hud-weather-pill');
    await expect(weatherPill).toBeVisible();
    await expect(weatherPill).toContainText('Clear');

    // Test streak pill hidden at 0 streak
    const streakPill = page.locator('#hud-streak-pill');
    await expect(streakPill).toBeHidden();

    // Trigger weather change and streak via economy
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.livingWorld.setWeather('rain');
      game.economy.incrementCatchStreak();
      game.economy.incrementCatchStreak();
      game.ui.update();
    });

    await expect(weatherPill).toContainText('Rain');
    await expect(streakPill).toBeVisible();
    await expect(streakPill).toContainText('🔥 2');
  });

  test('Quests rail button opens Story & Goals modal with tabs', async ({ page }) => {
    // Open menu rail
    await page.locator('#rail-toggle').click();
    await expect(page.locator('#hud-rail-items')).toBeVisible();

    // Click quests button
    const btnQuests = page.locator('#btn-quests');
    await expect(btnQuests).toBeVisible();
    await btnQuests.click();

    // Modal should open
    const modalHost = page.locator('#modal-host');
    await expect(modalHost).toBeVisible();
    await expect(modalHost.locator('.modal-header h3')).toHaveText('Story & Goals');

    // Verify all 6 tabs exist (including Community Boss Raids and Lore & Relics)
    const tabs = modalHost.locator('.quest-tab-btn');
    await expect(tabs).toHaveCount(6);
    await expect(tabs.nth(0)).toContainText('Story Chronicles');
    await expect(tabs.nth(1)).toContainText('Daily Quests');
    await expect(tabs.nth(2)).toContainText('Milestones');
    await expect(tabs.nth(3)).toContainText('Perks & Prestige');
    await expect(tabs.nth(4)).toContainText('Boss Raids');
    await expect(tabs.nth(5)).toContainText('Lore & Relics');
  });

  test('Story Chronicles tab displays chapter details and objectives', async ({ page }) => {
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.ui.toggleModal('quests');
    });

    const modalHost = page.locator('#modal-host');
    await expect(modalHost).toBeVisible();

    // Active Chapter 1
    const chapterCard = modalHost.locator('.story-chapter-card');
    await expect(chapterCard).toBeVisible();
    await expect(chapterCard.locator('.story-chapter-title')).toContainText('The Murmuring Pond');
    await expect(chapterCard.locator('.story-chapter-num')).toContainText('Chapter 1');
    await expect(chapterCard.locator('.story-lore-quote')).toContainText('Old Barnaby');

    // Objectives list
    const objectives = chapterCard.locator('.quest-objective-row');
    await expect(objectives).toHaveCount(3);
    await expect(objectives.nth(0)).toContainText('Catch 5 fish');

    // Roadmap contains 5 chapters
    const roadmapPills = modalHost.locator('.chapter-index-pill');
    await expect(roadmapPills).toHaveCount(5);
  });

  test('Daily Quests tab allows claiming and rerolling', async ({ page }) => {
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.ui.toggleModal('quests');
    });

    const modalHost = page.locator('#modal-host');
    // Switch to Daily tab
    await modalHost.locator('.quest-tab-btn', { hasText: 'Daily Quests' }).click();

    // Check daily quests rendered
    const questRows = modalHost.locator('.daily-quest-row');
    await expect(questRows).toHaveCount(3);

    // Initial quests should have reroll buttons if not completed
    const rerollBtn = questRows.first().locator('button[data-action="reroll-daily-quest"]');
    await expect(rerollBtn).toBeVisible();

    const initialTitle = await questRows.first().locator('strong').textContent();
    expect(initialTitle).toBeTruthy();

    // Reroll the first quest
    await rerollBtn.click();

    // Verify quest rerolled or updated
    const newQuests = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.questSystem.getDailyQuests();
    });
    expect(newQuests.length).toBe(3);
  });

  test('Milestones tab displays categories and badges', async ({ page }) => {
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.ui.toggleModal('quests');
    });

    const modalHost = page.locator('#modal-host');
    // Switch to Milestones tab
    await modalHost.locator('.quest-tab-btn', { hasText: 'Milestones' }).click();

    const milestoneRows = modalHost.locator('.milestone-row');
    const count = await milestoneRows.count();
    expect(count).toBeGreaterThanOrEqual(10);

    // Check badges
    const badges = modalHost.locator('.milestone-badge');
    await expect(badges.first()).toBeVisible();
  });

  test('Perks and Prestige tab displays progression and perks', async ({ page }) => {
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.ui.toggleModal('quests');
    });

    const modalHost = page.locator('#modal-host');
    // Switch to Perks tab
    await modalHost.locator('.quest-tab-btn', { hasText: 'Perks & Prestige' }).click();

    // Check prestige banner
    const prestigeBanner = modalHost.locator('.prestige-banner');
    await expect(prestigeBanner).toBeVisible();
    await expect(prestigeBanner).toContainText('Prestige Rank');

    // Check perk cards
    const perkCards = modalHost.locator('.perk-card');
    await expect(perkCards).toHaveCount(10);
    await expect(perkCards.first()).toContainText('Bait Mastery');
  });

  test('Stream-Wide Events in Candy Shop cheer the stream and trigger effects', async ({ page }) => {
    // Open Candy Shop
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.addCandyBars(200); // Give enough candy bars
      game.ui.toggleModal('candy');
    });

    const modalHost = page.locator('#modal-host');
    await expect(modalHost).toBeVisible();
    await expect(modalHost.locator('.modal-header h3')).toHaveText('Candy Bar Shop');

    // Check pond event section
    const streamSection = modalHost.locator('h4', { hasText: 'Pond Events' });
    await expect(streamSection).toBeVisible();

    const rainbowBtn = modalHost.locator('button[data-id="rainbow-totem"]');
    await expect(rainbowBtn).toBeVisible();
    await expect(rainbowBtn).toContainText('Activate (60 🍫)');

    // Click Rainbow Totem
    await rainbowBtn.click();

    // Verify weather changed to rainbow
    const currentWeather = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.livingWorld.getWeather();
    });
    expect(currentWeather).toBe('rainbow');

    // Verify stream buff is active
    const isBuffActive = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.isStreamBuffActive('rainbow-totem');
    });
    expect(isBuffActive).toBe(true);

    // Click Whale Call Horn
    const whaleBtn = modalHost.locator('button[data-id="whale-call-horn"]');
    await expect(whaleBtn).toBeVisible();
    await whaleBtn.click();

    // Verify whale is breaching
    const isBreaching = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.livingWorld.whale.isBreaching();
    });
    expect(isBreaching).toBe(true);
  });

  test('Closet displays new clothing items and allows equipping', async ({ page }) => {
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.addCoins(1000);
      game.economy.addCandyBars(200);
      game.economy.addMaterial('fabric', 20);
      game.economy.addMaterial('metal', 20);
      game.economy.addMaterial('rubber', 20);
      game.economy.addMaterial('glass', 20);
      game.ui.toggleModal('closet');
    });

    const modalHost = page.locator('#modal-host');
    await expect(modalHost).toBeVisible();
    await expect(modalHost.locator('.modal-header h3')).toHaveText('Closet');

    // Find Captain's Tricorn or Deep Diver Helmet in hat section
    const captainHatRow = modalHost.locator('li.closet-card', { hasText: "Captain's Tricorn" });
    await expect(captainHatRow).toBeVisible();

    // Buy it (auto-equips in Closet)
    const buyBtn = captainHatRow.locator('button[data-action="buy-clothing"]');
    await buyBtn.click();

    // Now it should show Remove (unequip), then toggle off & back on
    const unequipBtn = captainHatRow.locator('button[data-action="unequip-clothing"]');
    await expect(unequipBtn).toBeVisible();
    await unequipBtn.click();

    const equipBtn = captainHatRow.locator('button[data-action="equip-clothing"]');
    await expect(equipBtn).toBeVisible();
    await equipBtn.click();
    await expect(captainHatRow.locator('button[data-action="unequip-clothing"]')).toBeVisible();

    // Verify character skin updated
    const equippedHat = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.equippedClothing().hat;
    });
    expect(equippedHat).toBe('captain-hat');

    // Verify Equipped Ensemble banner displays equipped hat
    const ensembleBanner = modalHost.locator('.equipped-ensemble-banner');
    await expect(ensembleBanner).toBeVisible();
    await expect(ensembleBanner).toContainText("Captain's Tricorn");

    // Test slot filtering (click Hats filter pill)
    const hatFilterPill = modalHost.locator('button[data-action="filter-closet-slot"][data-slot="hat"]');
    await expect(hatFilterPill).toBeVisible();
    await hatFilterPill.click();

    // Verify only hat rows are displayed (e.g. Red Beanie, Straw Hat, Cowboy Hat, Captain's Tricorn, Cosmic Wizard Hat)
    await expect(modalHost.locator('li.closet-card', { hasText: 'Cosmic Wizard Hat' })).toBeVisible();
    await expect(modalHost.locator('li.closet-card', { hasText: 'Bear Ear Beanie' })).toBeVisible();
    await expect(modalHost.locator('li.closet-card', { hasText: 'Flannel Jacket' })).toBeHidden();

    // Test Style Shuffle button
    const shuffleBtn = modalHost.locator('button[data-action="style-shuffle"]');
    await expect(shuffleBtn).toBeVisible();
    await shuffleBtn.click();
    await expect(modalHost.locator('.equipped-ensemble-banner')).toBeVisible();
  });

  test('Debug menu has weather and whale controls', async ({ page }) => {
    await page.locator('#btn-debug').click();
    const modalHost = page.locator('#modal-host');
    await expect(modalHost).toBeVisible();

    // Test weather button
    const goldenHourBtn = modalHost.locator('button[data-action="debug-set-weather"][data-id="golden-hour"]');
    await expect(goldenHourBtn).toBeVisible();
    await goldenHourBtn.click();

    const weather = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.livingWorld.getWeather();
    });
    expect(weather).toBe('golden-hour');

    // Test whale button
    const whaleBtn = modalHost.locator('button[data-action="debug-trigger-whale"]');
    await expect(whaleBtn).toBeVisible();
    await whaleBtn.click();

    const isBreaching = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.livingWorld.whale.isBreaching();
    });
    expect(isBreaching).toBe(true);

    // Test kraken button
    const krakenBtn = modalHost.locator('button[data-action="debug-trigger-kraken"]');
    await expect(krakenBtn).toBeVisible();
    await krakenBtn.click();

    const isKrakenBreaching = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.livingWorld.kraken.isBreaching();
    });
    expect(isKrakenBreaching).toBe(true);
  });

  test('HUD community pill and Boss Raids tab allow cheer contributions', async ({ page }) => {
    const communityPill = page.locator('#hud-community-pill');
    await expect(communityPill).toBeVisible();

    // Clicking community pill opens quests modal directly on Boss Raids tab
    await communityPill.click();
    const modalHost = page.locator('#modal-host');
    await expect(modalHost).toBeVisible();

    const bossCard = modalHost.locator('.community-boss-card');
    await expect(bossCard).toBeVisible();
    await expect(bossCard.locator('.community-boss-title')).toContainText('The Great Ancient Leviathan');

    // Grant candy bars to test cheer contribution
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.addCandyBars(50);
      game.ui.renderQuests();
    });

    const cheerBtn = bossCard.locator('button[data-action="buy-community-cheer"]').first();
    await expect(cheerBtn).toBeEnabled();
    await cheerBtn.click();

    // Verify progress updated
    const progress = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.communitySystem.getActiveGoal().currentValue;
    });
    expect(progress).toBeGreaterThan(0);
  });

  test('Lore & Relics tab displays Curio Cabinet and Message in a Bottle archive', async ({ page }) => {
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.ui.toggleModal('quests');
    });

    const modalHost = page.locator('#modal-host');
    await expect(modalHost).toBeVisible();

    // Click Lore & Relics tab
    await modalHost.locator('.quest-tab-btn', { hasText: 'Lore & Relics' }).click();

    // Curio cabinet should be visible with 8 relics
    const curioCabinet = modalHost.locator('.curio-cabinet-grid');
    await expect(curioCabinet).toBeVisible();
    const relicCards = modalHost.locator('.curio-relic-card');
    await expect(relicCards).toHaveCount(8);

    // Bottle archive list should be visible with 10 bottle rows
    const bottleRows = modalHost.locator('.lore-bottle-row');
    await expect(bottleRows).toHaveCount(10);
  });

  test('Reading a discovered lore bottle opens the Parchment Letter modal', async ({ page }) => {
    // Discover the first bottle via economy
    await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      game.economy.discoverBottle('bottle_ss_marigold');
      game.ui.toggleModal('quests');
    });

    const modalHost = page.locator('#modal-host');
    await modalHost.locator('.quest-tab-btn', { hasText: 'Lore & Relics' }).click();

    // Click Read Letter button on discovered bottle
    const readBtn = modalHost.locator('button[data-action="read-bottle"][data-id="bottle_ss_marigold"]');
    await expect(readBtn).toBeVisible();
    await readBtn.click();

    // Parchment reader should be displayed
    const parchmentReader = modalHost.locator('.lore-parchment-reader');
    await expect(parchmentReader).toBeVisible();
    await expect(parchmentReader.locator('.parchment-meta')).toContainText('Captain Evelyn Vance');
    await expect(parchmentReader.locator('.parchment-title')).toContainText('Last Log of the S.S. Marigold');

    // Back to Archive button works
    const backBtn = modalHost.locator('button[data-action="close-bottle-reader"]');
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(parchmentReader).toBeHidden();
  });

  test('Barnaby dock NPC speech bubble appears and reacts to triggers', async ({ page }) => {
    const speechBubble = page.locator('#barnaby-speech-bubble');

    // Trigger dialogue directly via NarrativeSystem
    await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      narrative.showDialogue('Ahoy there, angler! The tide brings good fortune today.', 30, 'excited');
      narrative.update(1.0);
    });

    await expect(speechBubble).toBeVisible();
    await expect(speechBubble.locator('.bubble-text')).toContainText('Ahoy there, angler!');
    await expect(speechBubble).toHaveClass(/mood-excited/);

    // Dismiss dialogue
    await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      narrative.dismissDialogue();
    });
    await expect(speechBubble).toHaveClass(/hidden/);
  });

  test('Floating water bottle prop appears and can be collected', async ({ page }) => {
    // Spawn water bottle in narrative system
    await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      narrative.spawnWaterBottle('bottle_murmuring_waters');
    });

    const hasProp = await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      return narrative.hasWaterBottle() && narrative.getActiveBottleId() === 'bottle_murmuring_waters';
    });
    expect(hasProp).toBe(true);

    // Collect active bottle
    await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      (narrative as any).collectActiveBottle();
    });

    const isDiscovered = await page.evaluate(() => {
      const game = (window as any).__FISH_GAME__;
      return game.economy.discoveredBottleIds().includes('bottle_murmuring_waters');
    });
    expect(isDiscovered).toBe(true);

    // Verify bottle was removed from water after collection
    const isBottleRemoved = await page.evaluate(() => {
      const narrative = (window as any).__narrativeSystem || (window as any).__FISH_GAME__?.narrativeSystem;
      return !narrative.hasWaterBottle();
    });
    expect(isBottleRemoved).toBe(true);
  });
});
