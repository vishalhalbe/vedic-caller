-- Add profile fields to astrologers table.
ALTER TABLE astrologers
  ADD COLUMN IF NOT EXISTS bio              TEXT,
  ADD COLUMN IF NOT EXISTS specialization   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS experience_years INTEGER,
  ADD COLUMN IF NOT EXISTS photo_url        VARCHAR(500);
