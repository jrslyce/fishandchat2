import type { ClothingSlot } from '../game/data';

export interface CharacterState {
  ownedClothingIds: string[];
  equippedClothing: Record<ClothingSlot, string | null>;
  baseToneId: string;
  displayNameOverride: string | null;
}

export type CharacterStateStoreStatus = 'local-only' | 'synced' | 'error';

/**
 * Seam for syncing character-customization state to a remote (EBS-backed) store. The default
 * `LocalCharacterStateStore` is a no-op — it defers entirely to whatever's already in the
 * localStorage-backed GameSaveStateV1 — so nothing changes until a real remote implementation
 * is wired in (planned once the Closet UI needs cross-device sync).
 */
export interface CharacterStateStore {
  load(): Promise<CharacterState | null>;
  save(state: CharacterState): void;
  readonly status: CharacterStateStoreStatus;
}

export class LocalCharacterStateStore implements CharacterStateStore {
  readonly status: CharacterStateStoreStatus = 'local-only';

  async load(): Promise<CharacterState | null> {
    return null;
  }

  save(_state: CharacterState): void {
    // no-op — local save state already persists this via SaveManager
  }
}
