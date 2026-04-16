-- Prevent two users from calling the same astrologer simultaneously.
-- The DB enforces this even if the app-layer check has a race condition.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_call_per_astrologer
  ON calls(astrologer_id) WHERE status = 'active';
