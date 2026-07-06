const SAVE_KEY = 'fish-and-chat-save-v1';
// Bump whenever GameSaveStateV1's shape changes incompatibly (e.g. the Phase 1
// placeholder {coins,level,xp} -> Phase 2's full economy state). A version
// mismatch discards the old save rather than returning a partially-shaped
// object that crashes downstream reads.
const SAVE_VERSION = 2;

export interface SaveEnvelope<TState> {
  version: number;
  savedAt: number;
  state: TState;
}

export class SaveManager<TState> {
  constructor(private readonly defaultState: () => TState) {}

  load(): TState {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return this.defaultState();
      const parsed = JSON.parse(raw) as SaveEnvelope<TState>;
      if (parsed.version !== SAVE_VERSION) return this.defaultState();
      return parsed.state;
    } catch {
      return this.defaultState();
    }
  }

  save(state: TState): void {
    const envelope: SaveEnvelope<TState> = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      state,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
  }

  clear(): void {
    window.localStorage.removeItem(SAVE_KEY);
  }
}
