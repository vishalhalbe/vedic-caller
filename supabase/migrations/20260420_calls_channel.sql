-- Store Agora channel + token on call row so astrologer can join
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS agora_token text;
