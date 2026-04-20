-- Sprint 4: ratings on calls table
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS rating    smallint CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rated_at  timestamptz;

-- Prevent duplicate ratings
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_rated
  ON public.calls (id)
  WHERE rating IS NOT NULL;

-- Avg rating helper view (used by GET /astrologer)
CREATE OR REPLACE VIEW public.astrologer_avg_ratings AS
SELECT
  astrologer_id,
  ROUND(AVG(rating)::numeric, 2)  AS avg_rating,
  COUNT(*)                        AS rating_count
FROM public.calls
WHERE rating IS NOT NULL
  AND status = 'completed'
GROUP BY astrologer_id;
