-- Add earnings_balance to astrologers table.
-- Tracks cumulative earnings from completed calls; incremented server-side at call end.
ALTER TABLE astrologers
  ADD COLUMN IF NOT EXISTS earnings_balance DECIMAL(10, 2) NOT NULL DEFAULT 0;
