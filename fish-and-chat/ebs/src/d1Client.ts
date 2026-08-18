/**
 * Save storage on Cloudflare D1. Replaces the Firestore REST client: D1 binds
 * directly to the Worker, so there is no service-account key to hold, no OAuth
 * token to mint and cache, and no second cloud in the request path.
 *
 * Save state is stored as one opaque JSON string rather than mapped column by
 * column — the shape of GameSaveStateV1 is owned by the frontend and changes
 * over time (see migrateSaveState there); the Worker just round-trips whatever
 * JSON it is handed.
 */
export interface SaveDoc {
  state: unknown;
  updatedAt: number;
}

export interface D1Env {
  DB: D1Database;
}

interface SaveRow {
  state: string;
  updated_at: number;
}

export async function getSave(env: D1Env, key: string): Promise<SaveDoc | null> {
  const row = await env.DB.prepare('SELECT state, updated_at FROM saves WHERE key = ?')
    .bind(key)
    .first<SaveRow>();
  if (!row) return null;
  return { state: JSON.parse(row.state), updatedAt: row.updated_at };
}

/**
 * Upsert guarded on updatedAt, so a slow or retried request carrying an older
 * snapshot cannot clobber a newer one. A viewer can have the panel open on two
 * channels at once, and both tabs autosave the same key — without this the last
 * request to *arrive* wins rather than the most recent state, which silently
 * eats progress. Returns false when the write was rejected as stale.
 */
export async function putSave(
  env: D1Env,
  key: string,
  state: unknown,
  updatedAt: number,
): Promise<boolean> {
  const result = await env.DB.prepare(
    `INSERT INTO saves (key, state, updated_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(key) DO UPDATE SET
       state = excluded.state,
       updated_at = excluded.updated_at
     WHERE excluded.updated_at > saves.updated_at`,
  )
    .bind(key, JSON.stringify(state), updatedAt)
    .run();

  return (result.meta.changes ?? 0) > 0;
}
