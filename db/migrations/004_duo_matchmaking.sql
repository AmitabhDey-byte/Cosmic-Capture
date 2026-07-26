CREATE TABLE IF NOT EXISTS duo_lobbies (
  lobby_code UUID PRIMARY KEY,
  pilot_one_wallet TEXT NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  pilot_two_wallet TEXT NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (pilot_one_wallet <> pilot_two_wallet)
);

CREATE TABLE IF NOT EXISTS duo_queue_entries (
  wallet_address TEXT PRIMARY KEY REFERENCES players(wallet_address) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'matched')),
  lobby_code UUID REFERENCES duo_lobbies(lobby_code) ON DELETE SET NULL,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS duo_queue_waiting_idx ON duo_queue_entries (status, queued_at);
