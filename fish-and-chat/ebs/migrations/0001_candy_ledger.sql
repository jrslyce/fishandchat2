CREATE TABLE IF NOT EXISTS candy_wallets (
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS candy_ledger (
  entry_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS candy_ledger_wallet_idx
  ON candy_ledger(user_id, channel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS premium_entitlements (
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_id)
);
