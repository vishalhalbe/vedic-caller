CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  astrologer_id  uuid NOT NULL REFERENCES public.astrologers(id) ON DELETE CASCADE,
  amount         numeric(10,2) NOT NULL CHECK (amount > 0),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_astrologer ON public.withdrawal_requests(astrologer_id, status);
