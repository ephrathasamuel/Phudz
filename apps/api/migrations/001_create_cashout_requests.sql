CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cashout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_usdc NUMERIC(18,6) NOT NULL CHECK (amount_usdc > 0),
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cashout_requests_created_at_desc_idx
  ON cashout_requests (created_at DESC);