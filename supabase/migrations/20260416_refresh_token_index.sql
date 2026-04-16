-- Index on expires_at speeds up the expiry-filter query in POST /auth/refresh.
-- Without this the DB does a full table scan on every token refresh.
CREATE INDEX IF NOT EXISTS idx_rt_expires_at ON refresh_tokens(expires_at);
