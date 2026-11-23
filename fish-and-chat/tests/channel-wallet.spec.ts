import { expect, test } from '@playwright/test';

test('candy shop shows the current channel wallet', async ({ page }) => {
  await page.goto('/');
  await page.locator('#hud-candy-pill').click();
  await expect(page.locator('#modal-host')).toContainText('Channel Candy Wallets');
  await expect(page.locator('.candy-wallet-row')).toContainText('Local game');
  await expect(page.locator('.candy-wallet-wrapper')).toBeVisible();
});

test('channel candy cannot be spent on another channel', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const economyUrl = '/src/game/Economy.ts';
    const managerUrl = '/src/core/SaveManager.ts';
    const stateUrl = '/src/game/SaveState.ts';
    const [{ Economy }, { SaveManager }, { createDefaultSaveState }] = await Promise.all([
      import(economyUrl), import(managerUrl), import(stateUrl),
    ]);
    const economy = new Economy(new SaveManager(createDefaultSaveState, createDefaultSaveState()));
    economy.setActiveChannel('A', 'Streamer A', 'https://example.com/a.png');
    economy.addCandyBars(10);
    economy.persist();
    economy.setActiveChannel('B', 'Streamer B', null);
    const onB = economy.snapshot.candyBars;
    const spentOnB = economy.spendCandyBars(1);
    economy.addCandyBars(2);
    economy.persist();
    economy.setActiveChannel('A', 'Streamer A', 'https://example.com/a.png');
    return { onB, spentOnB, onA: economy.snapshot.candyBars, wallets: economy.candyWallets() };
  });
  expect(result.onB).toBe(0);
  expect(result.spentOnB).toBe(false);
  expect(result.onA).toBe(10);
  expect(result.wallets.A.balance).toBe(10);
  expect(result.wallets.B.balance).toBe(2);
  expect(result.wallets.A.activity[0].delta).toBe(10);
});

test('Muxy progress load uses the viewer-wide state and saves back to it', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const stateUrl = '/src/game/SaveState.ts';
    const progressUrl = '/src/systems/MuxyProgressStore.ts';
    const { createDefaultSaveState } = await import(stateUrl);
    const { initializeMuxyProgress } = await import(progressUrl);
    const cloudState = createDefaultSaveState();
    cloudState.level = 12;
    cloudState.activeChannelId = 'A';
    cloudState.candyBars = 7;
    cloudState.channelCandyWallets = { A: { name: 'Streamer A', avatarUrl: null, balance: 7, activity: [] } };
    const originalFetch = window.fetch;
    const posts: unknown[] = [];
    (window as unknown as { Twitch: unknown }).Twitch = {
      ext: {
        viewer: { id: 'viewer-123' },
        onAuthorized: (callback: (auth: unknown) => void) => callback({ clientId: 'extension-id', channelId: 'B', token: 'test-jwt', helixToken: 'helix' }),
      },
    };
    window.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('helix/users')) return new Response(JSON.stringify({ data: [{ display_name: 'Streamer B', profile_image_url: 'https://example.com/b.png' }] }), { status: 200 });
      if (url.includes('extension_viewer_state')) {
        if (init?.method === 'POST') {
          posts.push(JSON.parse(String(init.body)));
          return new Response('{}', { status: 200 });
        }
        return new Response(JSON.stringify({ fishAndChatSave: { version: 1, state: cloudState } }), { status: 200 });
      }
      return originalFetch(input, init);
    };
    try {
      const session = await initializeMuxyProgress();
      const loadedLevel = session.initialState?.level;
      session.onSave?.({ ...session.initialState!, level: 13 });
      await new Promise((resolve) => setTimeout(resolve, 3150));
      return { loadedLevel, channelId: session.channelId, channelName: session.channelName, posts };
    } finally {
      window.fetch = originalFetch;
    }
  });
  expect(result.loadedLevel).toBe(12);
  expect(result.channelId).toBe('B');
  expect(result.channelName).toBe('Streamer B');
  expect((result.posts[0] as { fishAndChatSave: { state: { level: number } } }).fishAndChatSave.state.level).toBe(13);
});
