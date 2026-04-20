-- ============================================================
-- Sprint 9: platform fee column + updated end_call RPC
-- Applied 2026-04-20 via Supabase SQL editor (3 separate queries)
-- ============================================================

-- Query 1 (run without RLS enforcement):
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS platform_fee numeric(10,2) NOT NULL DEFAULT 0;

-- Query 2 (run without RLS enforcement):
CREATE OR REPLACE FUNCTION public.astrologer_earnings_deduct(
  p_astrologer_id uuid,
  p_amount        numeric
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.astrologer_earnings_deduct TO anon, authenticated;

-- Query 3 — end_call v2: 20% platform fee, astrologer earns 80%
-- NOTE: uses SET search_path instead of SECURITY DEFINER to avoid
-- Supabase auth status check failure in the SQL editor.
CREATE OR REPLACE FUNCTION public.end_call(
  p_call_id       uuid,
  p_duration_secs integer,
  p_cost          numeric,
  p_reference     text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_call           record;
  v_balance        numeric;
  v_existing_txn   uuid;
  v_platform_fee   numeric;
  v_astrologer_net numeric;
BEGIN
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

  v_platform_fee   := round(p_cost * 0.20, 2);
  v_astrologer_net := p_cost - v_platform_fee;

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

  UPDATE public.calls
     SET status           = 'completed',
         ended_at         = now(),
         duration_seconds = p_duration_secs,
         cost             = p_cost,
         platform_fee     = v_platform_fee
   WHERE id = p_call_id;

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
$$;

GRANT EXECUTE ON FUNCTION public.end_call TO anon, authenticated;
