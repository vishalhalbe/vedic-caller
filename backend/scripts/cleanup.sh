#!/bin/sh
# JyotishConnect cleanup cron script
# Closes stale active calls and prunes expired refresh tokens.
#
# Setup (crontab -e):
#   */5 * * * * /path/to/cleanup.sh >> /var/log/jyotish-cleanup.log 2>&1
#
# Required env vars (set in the calling environment or a .env file):
#   CLEANUP_SECRET — must match CLEANUP_SECRET in the API process
#   API_URL        — base URL of the API (default: http://localhost:3000)

API_URL="${API_URL:-http://localhost:3000}"

if [ -z "$CLEANUP_SECRET" ]; then
  echo "[$(date -u +%FT%TZ)] ERROR: CLEANUP_SECRET not set" >&2
  exit 1
fi

# 1. Close stale calls (active > 1 hour) and restore astrologer availability
RESULT=$(wget -qO- \
  --header="x-cleanup-secret: $CLEANUP_SECRET" \
  --post-data='{}' \
  --header='Content-Type: application/json' \
  "$API_URL/call/cleanup" 2>&1)

echo "[$(date -u +%FT%TZ)] call/cleanup: $RESULT"

# 2. Prune expired/revoked refresh tokens older than 7 days
# Run directly against the DB — requires DB_URI to be set
if [ -n "$DB_URI" ]; then
  PRUNED=$(psql "$DB_URI" -At -c \
    "DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '1 day' OR (revoked = true AND created_at < NOW() - INTERVAL '7 days'); SELECT ROW_COUNT();" 2>&1)
  echo "[$(date -u +%FT%TZ)] refresh_tokens pruned: $PRUNED rows"
fi
