# JyotishConnect Security Model

## Database-Level Security (RLS)

⚠️ **IMPORTANT: Row-Level Security (RLS) is NOT in use.**

The PostgreSQL migrations define RLS policies (using `auth.uid()`), but these are **non-functional** because:

1. The backend connects to PostgreSQL as the superuser (`postgres`) via Sequelize, not as an authenticated Supabase user.
2. `auth.uid()` returns `NULL` for superuser connections, causing all policies to evaluate to `USING (NULL)`, which silently bypasses all checks.
3. This was set up anticipating Supabase Auth integration, which was never completed.

**Security implication:** All database-level row access controls are ineffective. The database cannot enforce that User A can only read User A's calls/transactions.

**Mitigation:** 100% of access control is enforced at the **application layer** in middleware and route handlers:

- `authMiddleware.js` — validates JWT token on protected routes
- Route handlers check `req.user.id === resource.user_id` before returning/modifying data
- `requireAdmin` middleware gate-keeps admin endpoints

**Future:** If upgrading to Supabase Auth:
1. Connect to PostgreSQL as an authenticated user (not superuser)
2. RLS policies will begin working
3. Application-layer checks become defense-in-depth

---

## Application-Layer Security

### Authentication
- Email/password auth with bcryptjs (10 rounds)
- JWT signed with 48-byte random secret, 7-day expiry
- Bearer token in Authorization header required on protected routes
- **Missing:** Token revocation / blacklisting (requires Redis, in TASK-11)

### Authorization
- All write endpoints require auth
- `GET /astrologer` is unauthenticated (by design — marketplace discoverability)
- Admin endpoints gated with `requireAdmin` middleware (checks `is_admin = true` in DB)
- Call lifecycle checked: `req.user.id === call.user_id`

### Payments
- Order amount verified server-side at order creation and payment success
- Razorpay webhook signature verified with timing-safe comparison (`crypto.timingSafeEqual`)
- Idempotent credit via `transactions.reference` UNIQUE constraint
- **Missing:** Refresh token pattern for long-lived sessions (TASK-11)

### Billing
- Rate read from astrologer DB record at call start (not client-supplied)
- Cost calculated server-side: `(rate_per_minute / 60) * duration_seconds`
- Cost deducted atomically with `SELECT ... FOR UPDATE` row lock
- Deduction prevented if wallet balance < amount

### API Rate Limiting
- Global limiter: 100 req/min per IP
- Auth limiter: 10 req/15min per IP on `/auth/*`

---

## Known Security Gaps

| Issue | Severity | Workaround | Fix |
|-------|----------|-----------|-----|
| RLS non-functional | High | App-layer checks | Supabase Auth integration |
| In-memory idempotency + PM2 cluster | Medium | Use sticky sessions | Redis (TASK-05) or single-process deployment |
| No token revocation | Medium | 7-day JWT expiry | TASK-11 refresh token pattern |
| Stale call cleanup missing | High | Manual `POST /call/cleanup` call | Cron job or background worker |
| No HTTPS enforcement | Medium | Configure at reverse proxy (Nginx) | Production deployment |

---

## Deployment Checklist

- [ ] Use HTTPS only (enforce via reverse proxy / load balancer)
- [ ] Set `NODE_ENV=production` (hides error details)
- [ ] Generate `JWT_SECRET` with `openssl rand -hex 48`
- [ ] Set `RAZORPAY_KEY_SECRET` from dashboard (never in code)
- [ ] Set `CLEANUP_SECRET` for `POST /call/cleanup` auth
- [ ] Run `POST /call/cleanup` every 5 minutes (via cron or scheduled task)
- [ ] Monitor `wallet_balance` for audit and reconciliation
- [ ] Log all `/webhook/razorpay` events for payment reconciliation
- [ ] Backup PostgreSQL regularly; RLS policies don't protect against DB compromise

---

## Incident Response

**If JWT secret is compromised:**
- Rotate the secret immediately
- All existing tokens remain valid until 7-day expiry
- Consider TASK-11 to enable immediate revocation

**If Razorpay webhook secret is compromised:**
- Rotate in Razorpay dashboard
- Update `RAZORPAY_WEBHOOK_SECRET` in production
- Verify webhook signatures are using the new secret

**If database is breached:**
- All user data (email, password hash, wallet balance) is exposed
- RLS does not provide protection (confirmed non-functional)
- Incident response: rotate all secrets, audit transactions
