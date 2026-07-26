CREATE TABLE IF NOT EXISTS powerup_purchases (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  powerup_id TEXT NOT NULL CHECK (powerup_id IN ('aegis-bloom', 'blink-shift', 'emp-bloom')),
  xlm_amount NUMERIC(20,7) NOT NULL CHECK (xlm_amount > 0),
  tx_hash TEXT NOT NULL UNIQUE REFERENCES stellar_transactions(tx_hash) ON DELETE RESTRICT,
  equipped BOOLEAN NOT NULL DEFAULT TRUE,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wallet_address, powerup_id)
);

CREATE INDEX IF NOT EXISTS powerup_purchases_wallet_idx ON powerup_purchases (wallet_address, purchased_at DESC);
