/**
 * Broadcaster config view — a separate, lightweight Vite entry (config.html) that does NOT
 * boot the Three.js game. Twitch loads this in an iframe from the extension's "Configuration"
 * dashboard. Lets the broadcaster choose whether their viewers' save progress is shared across
 * every channel they visit (global) or kept separate per-channel — read server-side by the EBS
 * via twitchConfig.ts's getBroadcasterSaveScope().
 */
type SaveScope = 'global' | 'channel';

interface TwitchConfigGlobal {
  ext?: {
    onAuthorized: (callback: (auth: { channelId: string }) => void) => void;
    configuration: {
      broadcaster?: { content: string; version: string };
      set: (segment: 'broadcaster', version: string, content: string) => void;
      onChanged: (callback: () => void) => void;
    };
  };
}

const CONFIG_VERSION = '1';

function parseScope(content: string | undefined): SaveScope {
  if (!content) return 'channel';
  try {
    const parsed = JSON.parse(content) as { saveScope?: string };
    return parsed.saveScope === 'global' ? 'global' : 'channel';
  } catch {
    return 'channel';
  }
}

function render(currentScope: SaveScope, onPick: (scope: SaveScope) => void): void {
  const root = document.querySelector<HTMLDivElement>('#config-root');
  if (!root) return;

  root.innerHTML = `
    <h1>Fish and Chat &mdash; Save Progress</h1>
    <p class="config-hint">Choose how your viewers' progress carries between streams.</p>
    <label class="config-option">
      <input type="radio" name="save-scope" value="channel" ${currentScope === 'channel' ? 'checked' : ''} />
      <span><strong>Channel-specific</strong><br />Progress resets fresh on your channel, separate from any other channel a viewer visits.</span>
    </label>
    <label class="config-option">
      <input type="radio" name="save-scope" value="global" ${currentScope === 'global' ? 'checked' : ''} />
      <span><strong>Shared across channels</strong><br />Viewers keep the same level and inventory on every channel running the extension. Requires the viewer to share their Twitch ID.</span>
    </label>
    <p id="config-status" class="config-status" aria-live="polite"></p>
  `;

  root.querySelectorAll<HTMLInputElement>('input[name="save-scope"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) onPick(input.value as SaveScope);
    });
  });
}

function init(): void {
  const twitch = (window as unknown as { Twitch?: TwitchConfigGlobal }).Twitch;
  if (!twitch?.ext) {
    console.error('[config] Twitch Extension Helper not present; configuration disabled.');
    render('channel', () => {});
    return;
  }

  const applyScope = (scope: SaveScope) => {
    twitch.ext?.configuration.set('broadcaster', CONFIG_VERSION, JSON.stringify({ saveScope: scope }));
    const status = document.querySelector('#config-status');
    if (status) status.textContent = 'Saved.';
  };

  twitch.ext.onAuthorized(() => {
    const scope = parseScope(twitch.ext?.configuration.broadcaster?.content);
    render(scope, applyScope);

    twitch.ext?.configuration.onChanged(() => {
      const updated = parseScope(twitch.ext?.configuration.broadcaster?.content);
      render(updated, applyScope);
    });
  });
}

init();
