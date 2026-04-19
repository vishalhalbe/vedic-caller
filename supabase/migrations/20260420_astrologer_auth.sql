-- Add auth fields to astrologers table
ALTER TABLE public.astrologers
  ADD COLUMN IF NOT EXISTS email          text UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash  text;

-- Index for login lookups
CREATE INDEX IF NOT EXISTS idx_astrologers_email ON public.astrologers(email);
