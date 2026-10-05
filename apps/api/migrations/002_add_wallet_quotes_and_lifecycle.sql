-- 002_add_wallet_quotes_and_lifecycle.sql

-- 1. Wallets table for demo user balances and holds
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE DEFAULT 'demo_user',
  balance_usdc NUMERIC(18,6) NOT NULL DEFAULT 2500.000000 CHECK (balance_usdc >= 0),
  held_usdc NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (held_usdc >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial demo wallet if not present
INSERT INTO wallets (user_id, balance_usdc, held_usdc)
VALUES ('demo_user', 2500.000000, 0)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Quotes table for locked FX rates and recipient verification
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'demo_user',
  amount_usdc NUMERIC(18,6) NOT NULL CHECK (amount_usdc > 0),
  fee_usdc NUMERIC(18,6) NOT NULL DEFAULT 0.500000 CHECK (fee_usdc >= 0),
  rate_kes_per_usdc NUMERIC(18,4) NOT NULL CHECK (rate_kes_per_usdc > 0),
  net_kes NUMERIC(18,2) NOT NULL CHECK (net_kes > 0),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_expires_at_idx ON quotes (expires_at);

-- 3. Update cashout_requests with lifecycle fields
ALTER TABLE cashout_requests
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'demo_user',
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id),
  ADD COLUMN IF NOT EXISTS fee_usdc NUMERIC(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_kes NUMERIC(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_kes NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;
