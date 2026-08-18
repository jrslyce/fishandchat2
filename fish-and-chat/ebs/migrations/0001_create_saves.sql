-- One row per save key. Keys are built by resolveSaveKey() in index.ts and are
-- either `global:<twitch user or U-opaque id>` or `channel:<channel>:<viewer>`.
CREATE TABLE IF NOT EXISTS saves (
  key        TEXT    PRIMARY KEY,
  state      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);
