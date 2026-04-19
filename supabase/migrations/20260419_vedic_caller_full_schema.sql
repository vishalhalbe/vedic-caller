-- ============================================================
-- JyotishConnect Full Schema Migration
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Extend users table ──────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email        text UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS name          text DEFAULT '',
  ADD COLUMN IF NOT EXISTS wallet_balance numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_admin      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz DEFAULT now();

-- ── 2. Extend astrologers table ────────────────────────────
-- Existing cols: id, name, specialty, languages, years_experience,
--                price_per_min, rating, avatar_url, is_online, about,
--                expertise_tags, created_at, updated_at
ALTER TABLE public.astrologers
  ADD COLUMN IF NOT EXISTS rate_per_minute  numeric(8,2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS is_available     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS earnings_balance numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bio              text,
  ADD COLUMN IF NOT EXISTS specialization   text,
  ADD COLUMN IF NOT EXISTS experience_years integer,
  ADD COLUMN IF NOT EXISTS photo_url        text;

-- Sync rate_per_minute from existing price_per_min (convert paise → rupees if needed)
UPDATE public.astrologers
  SET rate_per_minute = CASE
    WHEN price_per_min > 500 THEN price_per_min / 100.0  -- was stored in paise
    ELSE price_per_min
  END,
  is_available = is_online,
  bio = about,
  specialization = specialty,
  experience_years = years_experience,
  photo_url = avatar_url
WHERE rate_per_minute = 50 OR rate_per_minute IS NULL;

-- ── 3. calls table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(id),
  astrologer_id    uuid NOT NULL REFERENCES public.astrologers(id),
  duration_seconds integer DEFAULT 0,
  cost             numeric(10,2) DEFAULT 0,
  rate_per_minute  numeric(8,2) DEFAULT 0,
  status           text DEFAULT 'pending',
  started_at       timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calls_user_id       ON public.calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_astrologer_id ON public.calls(astrologer_id);
CREATE INDEX IF NOT EXISTS idx_calls_status        ON public.calls(status);

-- ── 4. transactions table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES public.users(id),
  amount    numeric(10,2) NOT NULL,
  type      text NOT NULL DEFAULT 'credit',
  status    text NOT NULL DEFAULT 'success',
  reference text DEFAULT '' UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id   ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions(reference);

-- ── 5. orders table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id         text PRIMARY KEY,  -- Razorpay order_id (order_xxx...)
  user_id    uuid NOT NULL REFERENCES public.users(id),
  amount     numeric(10,2) NOT NULL,
  status     text DEFAULT 'created',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── 6. refresh_tokens table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash    ON public.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);

-- ── 7. RLS — disable for service-role backend ──────────────
-- Our backend uses the publishable key which goes through PostgREST.
-- We use permissive RLS so the backend can operate on all rows.
-- Production: replace with proper RLS policies.

ALTER TABLE public.calls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Allow all operations from anon role (publishable key maps to anon in Supabase)
CREATE POLICY "anon full access" ON public.calls         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON public.transactions  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON public.orders        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON public.refresh_tokens FOR ALL TO anon USING (true) WITH CHECK (true);

-- Also allow authenticated role
CREATE POLICY "auth full access" ON public.calls         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full access" ON public.transactions  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full access" ON public.orders        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth full access" ON public.refresh_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Users and astrologers: open read for anon (needed for login and astrologer listing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='anon full access') THEN
    CREATE POLICY "anon full access" ON public.users FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='astrologers' AND policyname='anon full access') THEN
    CREATE POLICY "anon full access" ON public.astrologers FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 8. Wallet atomic functions ─────────────────────────────

-- wallet_deduct: atomically deducts amount, inserts transaction, returns new balance
CREATE OR REPLACE FUNCTION public.wallet_deduct(
  p_user_id   uuid,
  p_amount    numeric,
  p_reference text
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance numeric;
BEGIN
  -- Lock row to prevent concurrent deductions
  SELECT wallet_balance INTO v_balance
    FROM public.users
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.users
     SET wallet_balance = wallet_balance - p_amount
   WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, amount, type, status, reference)
  VALUES (p_user_id, p_amount, 'debit', 'success', p_reference)
  ON CONFLICT (reference) DO NOTHING;

  RETURN v_balance - p_amount;
END;
$$;

-- wallet_credit: atomically credits amount with idempotency, returns {balance, idempotent}
CREATE OR REPLACE FUNCTION public.wallet_credit(
  p_user_id   uuid,
  p_amount    numeric,
  p_reference text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance  numeric;
  v_existing uuid;
BEGIN
  -- Idempotency: if reference already credited, return current balance
  IF p_reference <> '' THEN
    SELECT id INTO v_existing
      FROM public.transactions
     WHERE reference = p_reference;

    IF FOUND THEN
      SELECT wallet_balance INTO v_balance FROM public.users WHERE id = p_user_id;
      RETURN jsonb_build_object('balance', v_balance, 'idempotent', true);
    END IF;
  END IF;

  UPDATE public.users
     SET wallet_balance = wallet_balance + p_amount
   WHERE id = p_user_id
  RETURNING wallet_balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.transactions (user_id, amount, type, status, reference)
  VALUES (p_user_id, p_amount, 'credit', 'success', p_reference)
  ON CONFLICT (reference) DO NOTHING;

  RETURN jsonb_build_object('balance', v_balance, 'idempotent', false);
END;
$$;

-- start_call: atomically locks astrologer + creates call record
CREATE OR REPLACE FUNCTION public.start_call(
  p_user_id       uuid,
  p_astrologer_id uuid,
  p_rate          numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available boolean;
  v_call_id   uuid;
  v_started   timestamptz;
BEGIN
  SELECT is_available INTO v_available
    FROM public.astrologers
   WHERE id = p_astrologer_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Astrologer not found';
  END IF;

  IF NOT v_available THEN
    RAISE EXCEPTION 'Astrologer is not available';
  END IF;

  UPDATE public.astrologers SET is_available = false WHERE id = p_astrologer_id;

  v_started := now();
  INSERT INTO public.calls (user_id, astrologer_id, status, started_at, cost, duration_seconds, rate_per_minute)
  VALUES (p_user_id, p_astrologer_id, 'active', v_started, 0, 0, p_rate)
  RETURNING id INTO v_call_id;

  RETURN jsonb_build_object('call_id', v_call_id, 'started_at', v_started);
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.wallet_deduct  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_credit  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_call     TO anon, authenticated;
