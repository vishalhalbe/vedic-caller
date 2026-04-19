-- ============================================================
-- end_call RPC: atomically finalise call, deduct wallet,
-- credit astrologer earnings, restore availability
-- ============================================================

CREATE OR REPLACE FUNCTION public.end_call(
  p_call_id         uuid,
  p_duration_secs   integer,
  p_cost            numeric,
  p_reference       text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_call         record;
  v_balance      numeric;
  v_existing_txn uuid;
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

  -- Idempotency: skip wallet deduction if already processed
  SELECT id INTO v_existing_txn
    FROM public.transactions
   WHERE reference = p_reference;

  IF NOT FOUND THEN
    -- Deduct wallet (raises if insufficient balance)
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

  -- Update call record
  UPDATE public.calls
     SET status           = 'completed',
         ended_at         = now(),
         duration_seconds = p_duration_secs,
         cost             = p_cost
   WHERE id = p_call_id;

  -- Credit astrologer earnings + restore availability (atomic increment — no read-modify-write)
  UPDATE public.astrologers
     SET is_available     = true,
         earnings_balance = earnings_balance + p_cost
   WHERE id = v_call.astrologer_id;

  RETURN jsonb_build_object(
    'duration', p_duration_secs,
    'cost',     p_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_call TO anon, authenticated;
