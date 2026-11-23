const SAVE_KEY = 'fish-and-chat-save-v1';
// Bump whenever GameSaveStateV1's shape changes incompatibly (e.g. the Phase 1
// placeholder {coins,level,xp} -> Phase 2's full economy state). A version
// mismatch discards the old save rather than returning a partially-shaped
// object that crashes downstream reads.
// v3: added ownedClothingIds/equippedClothing/baseToneId/displayNameOverride
// for the player voxel character.
const SAVE_VERSION = 3;

export interface SaveEnvelope<TState> {
  version: number;
  savedAt: number;
  state: TState;
}

export class SaveManager<TState> {
  constructor(
    private readonly defaultState: () => TState,
    private readonly initialState?: TState,
    private readonly onSave?: (state: TState) => void,
    private readonly storageKey: string = SAVE_KEY,
    private readonly onFlush?: (keepalive?: boolean) => Promise<void>,
  ) {}

  load(): TState {
    if (this.initialState) return this.initialState;
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return this.defaultState();
      const parsed = JSON.parse(raw) as SaveEnvelope<TState>;
      if (!parsed || typeof parsed !== 'object' || parsed.version !== SAVE_VERSION || !parsed.state || typeof parsed.state !== 'object') {
        return this.defaultState();
      }
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
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(envelope));
    } catch {
      // Third-party iframes (Safari ITP / private mode) or full quotas may reject localStorage.
    }
    this.onSave?.(state);
  }

  clear(): void {
    try {
      window.localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore storage restrictions in embedded iframes.
    }
  }

  flush(keepalive = false): Promise<void> {
    return this.onFlush ? this.onFlush(keepalive) : Promise.resolve();
  }
}
