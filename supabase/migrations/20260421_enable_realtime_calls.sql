-- Enable Supabase Realtime for the calls table.
-- Astrologer dashboard subscribes to INSERT events filtered by astrologer_id
-- to detect incoming calls instantly (replaces 5-sec HTTP polling).
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
