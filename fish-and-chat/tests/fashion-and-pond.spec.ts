import { expect, test } from '@playwright/test';

test('hero cosmetics appear after unlock and can be equipped independently', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ Economy }, { SaveManager }, { createDefaultSaveState }, { PlayerCharacter }] = await Promise.all([
      import(String('/src/game/Economy.ts')),
      import(String('/src/core/SaveManager.ts')),
      import(String('/src/game/SaveState.ts')),
      import(String('/src/entities/character/PlayerCharacter.ts')),
    ]);
    const state = createDefaultSaveState();
    state.candyBars = 200;
    const economy = new Economy(new SaveManager(createDefaultSaveState, state));
    const before = economy.cosmeticEquipped('rod');
    const bought = economy.buyPremiumItem('golden-rod-skin');
    const equipped = economy.cosmeticEquipped('rod');
    const character = new PlayerCharacter();
    character.setGoldenRod(true);
    const blank = character.group.getObjectByName('rod-blank') as any;
    const golden = blank.material.color.getHexString();
    economy.setCosmeticEquipped('rod', null);
    character.setGoldenRod(false);
    const regular = blank.material.color.getHexString();
    character.dispose();
    return { before, bought, equipped, golden, regular, stillOwned: economy.ownsPremiumItem('golden-rod-skin') };
  });
  expect(result.before).toBeNull();
  expect(result.bought.ok).toBe(true);
  expect(result.equipped).toBe('golden-rod-skin');
  expect(result.golden).not.toBe(result.regular);
  expect(result.stillOwned).toBe(true);
});

test('saved outfits survive a fresh Economy and restore owned pieces', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ Economy }, { SaveManager }, { createDefaultSaveState }] = await Promise.all([
      import(String('/src/game/Economy.ts')), import(String('/src/core/SaveManager.ts')), import(String('/src/game/SaveState.ts')),
    ]);
    const state = createDefaultSaveState();
    state.ownedClothingIds.push('red-beanie');
    const economy = new Economy(new SaveManager(createDefaultSaveState, state));
    economy.equipClothing('hat', 'red-beanie');
    economy.saveOutfitPreset(0);
    economy.equipClothing('hat', null);
    const restored = new Economy(new SaveManager(createDefaultSaveState));
    restored.wearOutfitPreset(0);
    return { preset: restored.outfitPresets()[0]?.clothing.hat, equipped: restored.equippedClothing().hat };
  });
  expect(result).toEqual({ preset: 'red-beanie', equipped: 'red-beanie' });
});

test('debug pond renders 101 named fishers in one overview', async ({ page }, testInfo) => {
  await page.goto('/?debugPond=101');
  await page.waitForFunction(() => Boolean((window as any).__FISH_GAME__), null, { timeout: 20000 });
  await expect(page.locator('#pond-presence-button')).toContainText('101');
  await page.locator('#pond-presence-button').click();
  await expect(page.locator('.pond-fisher-marker')).toHaveCount(101);
  await expect(page.locator('.pond-roster-row')).toHaveCount(101);
  await page.locator('.pond-fisher-marker').first().click();
  await expect(page.locator('.pond-presence-status')).toContainText('Debug fisher 1');
  await page.screenshot({ path: testInfo.outputPath('shared-pond-101.png') });
});

test('Twitch Bits flow requires a registered SKU and server fulfillment', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'bits-test-frame';
    document.body.append(frame);
  });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  const result = await frame.evaluate(async () => {
    const { MuxySystem } = await import(String('/src/systems/MuxySystem.ts'));
    let transactionCallback: ((value: { initiator: string; transactionID: string; transactionReceipt: string }) => void) | undefined;
    let usedSku = '';
    let appliedBalance = -1;
    let locked = false;
    const requests: string[] = [];
    (window as any).Twitch = { ext: {
      onAuthorized: () => {},
      features: { isBitsEnabled: true },
      bits: {
        getProducts: async () => [{ sku: 'pack-snack', cost: { amount: '100', type: 'bits' } }],
        useBits: (sku: string) => { usedSku = sku; },
        onTransactionComplete: (callback: typeof transactionCallback) => { transactionCallback = callback; },
      },
    } };
    const originalFetch = window.fetch;
    window.fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      requests.push(path);
      if (path === '/wallet') return new Response(JSON.stringify({ wallets: [], ownedPremiumItemIds: [] }), { status: 200 });
      if (path === '/bits/fulfill') return new Response(JSON.stringify({ outcome: 'credited', wallet: {
        wallets: [{ channel_id: '123', balance: 10 }], ownedPremiumItemIds: [],
      } }), { status: 200 });
      return new Response('{}', { status: 404 });
    };
    try {
      const system = new MuxySystem({ useServerCandy: () => { locked = true; }, grantCandyBars: () => { throw new Error('local grant'); } } as any,
        { setServerCandyMode: () => {}, applyServerWallet: (snapshot: any) => { appliedBalance = snapshot.wallets.find((wallet: any) => wallet.channel_id === '123')?.balance ?? 0; } } as any,
        { emit: () => {} } as any, 'https://example.test');
      await system.init({ token: 'signed-test-token', channelId: '123' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const configured = system.isConfigured;
      system.purchaseCandyPack('pack-snack');
      transactionCallback?.({ initiator: 'other', transactionID: 'other-tx', transactionReceipt: '' });
      transactionCallback?.({ initiator: 'current_user', transactionID: 'own-tx', transactionReceipt: '' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { configured, locked, usedSku, appliedBalance, fulfillCalls: requests.filter((path) => path === '/bits/fulfill').length };
    } finally { window.fetch = originalFetch; }
  });
  expect(result).toEqual({ configured: true, locked: true, usedSku: 'pack-snack', appliedBalance: 10, fulfillCalls: 1 });
});

test('Twitch wallet ignores client-awarded bars and local candy spends', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const [{ Economy }, { SaveManager }, { createDefaultSaveState }] = await Promise.all([
      import(String('/src/game/Economy.ts')), import(String('/src/core/SaveManager.ts')), import(String('/src/game/SaveState.ts')),
    ]);
    const state = createDefaultSaveState();
    state.candyBars = 500;
    const economy = new Economy(new SaveManager(createDefaultSaveState, state));
    economy.setServerCandyMode();
    economy.addCandyBars(50);
    return { balance: economy.snapshot.candyBars, localSpend: economy.spendCandyBars(1),
      premium: economy.buyPremiumItem('golden-rod-skin'), owned: economy.ownsPremiumItem('golden-rod-skin') };
  });
  expect(result).toEqual({ balance: 0, localSpend: false, premium: { ok: false, reason: 'server-required' }, owned: false });
});

test('unshared Twitch identity cannot start cross-channel progress', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'identity-test-frame';
    document.body.append(frame);
  });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  const result = await frame.evaluate(async () => {
    const { initializeMuxyProgress } = await import(String('/src/systems/MuxyProgressStore.ts'));
    const originalSetTimeout = window.setTimeout;
    let shareRequested = false;
    (window as any).Twitch = { ext: { viewer: { id: null }, actions: { requestIdShare: () => { shareRequested = true; } },
      onAuthorized: (callback: (auth: unknown) => void) => callback({ clientId: 'test-extension', channelId: '123', token: 'test-token' }) } };
    window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) =>
      originalSetTimeout(callback, delay === 12_000 ? 0 : delay, ...args)) as typeof window.setTimeout;
    try {
      const session = await initializeMuxyProgress();
      return { requiresIdentity: session.requiresIdentity, shareRequested, initialState: Boolean(session.initialState) };
    } finally { window.setTimeout = originalSetTimeout; }
  });
  expect(result).toEqual({ requiresIdentity: true, shareRequested: true, initialState: false });
});
