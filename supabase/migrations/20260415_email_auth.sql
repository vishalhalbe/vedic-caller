/*
  # Email/Password Auth — replace phone-only login

  Adds email + password_hash columns to users.
  phone becomes optional (nullable) — kept for future OTP upgrade.
  rate_per_minute added to calls so billing cannot be manipulated client-side.
*/

-- Email auth columns
ALTER TABLE users
  ALTER COLUMN phone DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Store rate at call creation (security fix: prevents client rate manipulation)
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS rate_per_minute NUMERIC(8,2) NOT NULL DEFAULT 0;

-- Production hardening constraints (use DO block for idempotency)
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT chk_wallet_non_negative CHECK (wallet_balance >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE calls ADD CONSTRAINT chk_call_status
    CHECK (status IN ('pending','active','completed','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE calls ADD CONSTRAINT chk_call_cost_non_negative CHECK (cost >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE calls ADD CONSTRAINT chk_duration_non_negative CHECK (duration_seconds >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD CONSTRAINT chk_txn_type CHECK (type IN ('credit','debit'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD CONSTRAINT chk_txn_status
    CHECK (status IN ('pending','success','failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD CONSTRAINT uq_transaction_reference UNIQUE (reference);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unique index: one active call per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_call_per_user
  ON calls (user_id) WHERE status = 'active';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_calls_status         ON calls (status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at     ON calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_astrologers_available ON astrologers (is_available)
  WHERE is_available = true;
