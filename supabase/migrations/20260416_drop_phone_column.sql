-- Drop the phone column added during original phone-auth implementation.
-- Phone auth was replaced with email/password (migration 20260415_email_auth.sql).
ALTER TABLE users DROP COLUMN IF EXISTS phone;
