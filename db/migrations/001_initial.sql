CREATE TABLE IF NOT EXISTS players (
  wallet_address TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'Pilot',
  wallet_provider TEXT NOT NULL,
  avatar_key TEXT NOT NULL DEFAULT 'kira-pixel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  match_ref TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('solo', 'duo', 'tournament')),
  cores INTEGER NOT NULL DEFAULT 0 CHECK (cores >= 0),
  placement INTEGER CHECK (placement > 0),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  result_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS matches_leaderboard_idx ON matches (mode, cores DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_wallet_idx ON matches (wallet_address, created_at DESC);

CREATE TABLE IF NOT EXISTS stellar_transactions (
  tx_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  action TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'testnet',
  contract_id TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stellar_transactions_wallet_idx ON stellar_transactions (wallet_address, created_at DESC);

CREATE TABLE IF NOT EXISTS reward_claims (
  match_ref TEXT PRIMARY KEY REFERENCES matches(match_ref) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  asset_code TEXT NOT NULL,
  asset_issuer TEXT NOT NULL,
  amount NUMERIC(20,7) NOT NULL CHECK (amount > 0),
  tx_hash TEXT NOT NULL UNIQUE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT REFERENCES players(wallet_address) ON DELETE SET NULL,
  score INTEGER CHECK (score BETWEEN 1 AND 5),
  message TEXT NOT NULL CHECK (char_length(message) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
