-- RPC to atomically deduct from astrologer earnings_balance
-- Used by admin withdrawal approval

CREATE OR REPLACE FUNCTION public.astrologer_earnings_deduct(
  p_astrologer_id uuid,
  p_amount        numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
