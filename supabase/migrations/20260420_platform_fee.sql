-- ============================================================
-- Sprint 9: platform fee column + updated end_call RPC
-- Run via: supabase db push  (or paste entire file at once in SQL editor)
-- ============================================================

-- 1. Add platform_fee column (safe on existing tables)
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS platform_fee numeric(10,2) NOT NULL DEFAULT 0;

-- 2. Atomic earnings-deduct RPC (used by admin withdrawal approval)
CREATE OR REPLACE FUNCTION public.astrologer_earnings_deduct(
  p_astrologer_id uuid,
  p_amount        numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_balance numeric;
BEGIN
  SELECT earnings_balance INTO v_balance
    FROM public.astrologers
   WHERE id = p_astrologer_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Astrologer not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient earnings balance';
  END IF;

  UPDATE public.astrologers
     SET earnings_balance = earnings_balance - p_amount
   WHERE id = p_astrologer_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.astrologer_earnings_deduct TO anon, authenticated;

-- 3. end_call RPC v2: 20% platform fee, astrologer earns 80%
CREATE OR REPLACE FUNCTION public.end_call(
  p_call_id       uuid,
  p_duration_secs integer,
  p_cost          numeric,
  p_reference     text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_call           record;
  v_balance        numeric;
  v_existing_txn   uuid;
  v_platform_fee   numeric;
  v_astrologer_net numeric;
BEGIN
  -- Lock call row
  SELECT * INTO v_call
    FROM public.calls
   WHERE id = p_call_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found';
  END IF;

  IF v_call.status <> 'active' THEN
    RAISE EXCEPTION 'Call already ended';
  END IF;

  -- 20 % platform commission
  v_platform_fee   := round(p_cost * 0.20, 2);
  v_astrologer_net := p_cost - v_platform_fee;

  -- Idempotency: skip wallet deduction if already processed
  SELECT id INTO v_existing_txn
    FROM public.transactions
   WHERE reference = p_reference;

  IF NOT FOUND THEN
    SELECT wallet_balance INTO v_balance
      FROM public.users
     WHERE id = v_call.user_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'User not found';
    END IF;

    IF v_balance < p_cost THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;

    UPDATE public.users
       SET wallet_balance = wallet_balance - p_cost
     WHERE id = v_call.user_id;

    INSERT INTO public.transactions (user_id, amount, type, status, reference)
    VALUES (v_call.user_id, p_cost, 'debit', 'success', p_reference)
    ON CONFLICT (reference) DO NOTHING;
  END IF;

  -- Update call with fee breakdown
  UPDATE public.calls
     SET status           = 'completed',
         ended_at         = now(),
         duration_seconds = p_duration_secs,
         cost             = p_cost,
         platform_fee     = v_platform_fee
   WHERE id = p_call_id;

  -- Credit astrologer net (80%)
  UPDATE public.astrologers
     SET is_available     = true,
         earnings_balance = earnings_balance + v_astrologer_net
   WHERE id = v_call.astrologer_id;

  RETURN jsonb_build_object(
    'duration',       p_duration_secs,
    'cost',           p_cost,
    'platform_fee',   v_platform_fee,
    'astrologer_net', v_astrologer_net
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.end_call TO anon, authenticated;
