# SKILL: JyotishConnect (Vedic Caller)

> Generated via Skill_Seekers analysis pipeline — architecture_overview + api_documentation + security_focus + skill_polish stages

## Overview

JyotishConnect is a production-ready **Vedic astrology voice consulting platform** that connects seekers (users) with astrologers for real-time voice consultations. The platform handles per-minute billing, atomic wallet deductions, email/password auth with JWT + refresh tokens, and Razorpay payment integration.

**Tech Stack:**
- Mobile: Flutter (Dart)
- Backend: Node.js + Express
- Database: PostgreSQL (Supabase) via `@supabase/supabase-js` (Sequelize removed)
- Voice: Agora RTC
- Payments: Razorpay

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Flutter Mobile App (12 screens)               │
│                                                                  │
│  SEEKER FLOW                      ASTROLOGER FLOW                │
│  /login → /home                   /login → /astrologer-home      │
│  /astrologer/:id → /call          /earnings → /call (astrologer) │
│  /history  /wallet  /profile      incoming_call_screen           │
│                                                                  │
│  State: Riverpod (FutureProvider + StateNotifier)                │
│  Nav:   GoRouter (path params + extra)                           │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTP/JWT  (Dio + interceptors)
┌─────────────────────────▼────────────────────────────────────────┐
│                Node.js / Express API (13 route files)            │
│                                                                  │
│  /auth           register, login, refresh, logout                │
│  /astrologer/auth register, login (role=astrologer JWT)          │
│  /astrologer     list (ratings), :id profile                     │
│  /astrologer/me  me, availability, earnings, withdrawal          │
│  /call           start, end, decline, incoming, cleanup          │
│  /callHistory    paginated history                               │
│  /wallet         balance, transactions, test-credit              │
│  /payment        create-order, success                           │
│  /webhook        Razorpay payment.captured                       │
│  /admin          stats, astrologers, seed                        │
│  /health  /metrics                                               │
│                                                                  │
│  Middleware: pino-http → CORS → Rate limiter → JWT → Idempotency │
│  Services:  callLifecycle · walletEngine · walletService         │
└─────────────────────────┬────────────────────────────────────────┘
                          │ @supabase/supabase-js (REST + RPC)
┌─────────────────────────▼────────────────────────────────────────┐
│              PostgreSQL via Supabase (16 migrations)             │
│                                                                  │
│  users · astrologers · calls · transactions · orders             │
│  refresh_tokens · withdrawal_requests                            │
│  VIEW: astrologer_avg_ratings                                    │
│  RPC:  end_call() — atomic deduct + update + credit              │
└─────────────────────────┬────────────────────────────────────────┘
                          │ webhooks / SDK
┌─────────────────────────▼────────────────────────────────────────┐
│   Razorpay (payments + webhook)  │  Agora RTC v6 (voice calls)   │
└──────────────────────────────────────────────────────────────────┘
```

**Architecture Style:** Layered monolith — presentation (Flutter) → API (Express) → service layer → data layer (Supabase)

---

## Key Concepts

1. **Atomic Wallet Deduction** — All balance changes use `SELECT ... FOR UPDATE` + DB transaction to prevent race conditions and negative balances.
2. **Call Lifecycle** — A call session tracks `startTime`, computes `duration` on end, then atomically deducts `(rate / 60) * duration` from the user's wallet.
3. **Idempotency** — In-memory key store prevents duplicate API operations (payment capture, wallet deduct) on retry.
4. **Per-minute Billing** — Rate is stored as `rate_per_minute` (INR). Cost is pro-rated per second: `cost = (rate / 60) * seconds`.
5. **RLS Security** — Supabase Row Level Security ensures users can only access their own calls, wallets, and transactions.

---

## Quick Start

### Run Backend
```bash
cd backend/api
npm install
node app.js           # Listens on PORT (default 3000)
```

### Run Flutter App
```bash
cd apps/mobile
flutter pub get
flutter run
```

### Key Environment Variables
```
PORT=3000
SUPABASE_URL=https://...           # Supabase project URL
SUPABASE_KEY=sb_publishable_...   # Supabase anon/publishable key
JWT_SECRET=...                     # Required: min 48 hex chars
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
ADMIN_SEED_SECRET=...              # Bootstrap first admin via POST /admin/seed
CLEANUP_SECRET=...                 # Cron secret for POST /call/cleanup
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | None | Register with email + password |
| POST | `/auth/login` | None | Email/password → JWT + refresh_token |
| POST | `/auth/refresh` | None | Rotate refresh_token → new access token |
| POST | `/auth/logout` | JWT | Revoke refresh token |
| GET | `/astrologer` | None | List available astrologers |
| POST | `/call/start` | JWT | Start call → Agora channel + token |
| POST | `/call/end` | JWT | End call → atomic wallet deduction |
| POST | `/call/cleanup` | x-cleanup-secret | Cron: close stale calls > 1h |
| GET | `/callHistory` | JWT | Paginated call history `{data, pagination}` |
| GET | `/wallet/balance` | JWT | Current wallet balance |
| POST | `/wallet/topup` | JWT | Top up wallet (test/admin) |
| POST | `/payment/create-order` | JWT | Create Razorpay order server-side |
| POST | `/payment/success` | JWT | Verify + credit wallet after payment |
| POST | `/webhook/razorpay` | HMAC | Razorpay payment.captured event |
| GET | `/admin/astrologers` | JWT+Admin | List all astrologers (admin) |
| POST | `/admin/astrologers` | JWT+Admin | Create astrologer |
| PUT | `/admin/astrologers/:id` | JWT+Admin | Update astrologer |
| POST | `/admin/seed` | x-seed-secret | Bootstrap first admin (no JWT) |
| GET | `/metrics` | None | Uptime + memory metrics |

---

## Data Model

```sql
users          (id uuid PK, email unique, password_hash, name,
                wallet_balance numeric DEFAULT 0, is_admin bool DEFAULT false,
                created_at, updated_at)
                -- chk_wallet_non_negative: wallet_balance >= 0
astrologers    (id uuid PK, name, rate_per_minute numeric, is_available bool,
                bio, specialization, experience_years, photo_url, earnings_balance)
calls          (id uuid PK, user_id FK→users, astrologer_id FK→astrologers,
                channel, rate_per_minute, duration_seconds int, cost numeric,
                status (active|completed|cancelled), started_at, ended_at)
                -- idx_one_active_call_per_astrologer: UNIQUE (astrologer_id) WHERE status='active'
transactions   (id uuid PK, user_id FK→users, amount numeric,
                type (credit|debit), status DEFAULT 'success', reference unique)
orders         (id uuid PK, user_id FK→users, razorpay_order_id unique,
                amount numeric, status (pending|paid|failed), payment_id)
refresh_tokens (id uuid PK, user_id FK→users ON DELETE CASCADE,
                token_hash unique, expires_at, created_at)
                -- idx_rt_expires_at: INDEX (expires_at)
```

---

## Business Rules

- Balance must never go negative — `chk_wallet_non_negative` DB constraint + `atomicDeduct` FOR UPDATE lock
- Payment signatures must be verified via HMAC-SHA256 before crediting
- Call cost is always computed server-side via `calculateDeduction(rate, seconds)` — never trust client-submitted cost
- `finaliseCall` wraps wallet deduction + call update + astrologer credit in a single transaction — atomically or not at all
- Rate limiting: global 100/min, auth endpoints 10 per 15min (disabled in test env)
- Refresh tokens are hashed (SHA-256) before storage; rotation revokes the old token
- Minimum wallet top-up: ₹10 (enforced client-side in WalletWidget)
- Agora calls auto-end at 55 minutes to prevent silent disconnect when token expires at 60 minutes
- `CLEANUP_SECRET` must be set for `/call/cleanup` to accept requests

---

## Component Map

| File | Responsibility |
|------|----------------|
| `backend/api/app.js` | Express app bootstrap, middleware chain |
| `backend/api/services/callLifecycle.js` | Start/end call session; single outer transaction |
| `backend/api/services/walletEngine.js` | `atomicDeduct` (FOR UPDATE lock) + `atomicCredit` |
| `backend/api/services/walletService.js` | `calculateDeduction` — single billing formula |
| `backend/api/services/jwt.js` | Sign/verify access tokens (15m, with jti nonce) |
| `backend/api/services/razorpayService.js` | HMAC signature verification |
| `backend/api/routes/auth.js` | Register/login/refresh/logout with refresh tokens |
| `backend/api/routes/call.js` | call/start, call/end, call/cleanup |
| `backend/api/routes/webhook_v2.js` | Razorpay webhook handler + idempotency |
| `backend/api/routes/adminBootstrap.js` | POST /admin/seed (no JWT, x-seed-secret) |
| `backend/api/middleware/authMiddleware.js` | JWT verification + requireAdmin guard |
| `backend/api/middleware/rateLimiter.js` | Global + auth rate limits (disabled in NODE_ENV=test) |
| `backend/api/config/db.js` | Supabase client (createClient with SUPABASE_URL + SUPABASE_KEY) |
| `supabase/migrations/` | Full schema + RPCs: wallet_deduct, wallet_credit, start_call, end_call |
| `apps/mobile/lib/features/call/call_screen_v2.dart` | In-call timer, cost display, 55-min auto-end |
| `apps/mobile/lib/features/auth/login_screen_v2.dart` | Email/password login + register flow |
| `apps/mobile/lib/features/wallet/wallet_widget.dart` | Top-up with ₹10 minimum guard |
| `apps/mobile/lib/features/history/history_screen.dart` | Paginated call history (unwraps `{data}`) |
| `apps/mobile/lib/services/call_service.dart` | Flutter ↔ API call bridge |
| `apps/mobile/lib/core/token_storage.dart` | Secure storage for access/refresh/is_admin |
| `supabase/migrations/` | Schema + RLS policies applied in order |
| `nginx/nginx.conf` | Reverse proxy with TLS + HSTS header |

---

## External Integrations

| Service | Usage | Config |
|---------|-------|--------|
| Razorpay | Payment orders + webhook capture | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Agora RTC | Voice channel token generation | `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` |
| Supabase | PostgreSQL + RLS + migrations | `DATABASE_URL` |

---

## Quality & Launch Checklist

- [ ] Backend deployed to production URL
- [ ] Mobile app pointed at prod API endpoint
- [ ] Razorpay live keys configured + webhook verified
- [ ] Agora production credentials set
- [ ] Real-device call flow tested
- [ ] Billing accuracy validated (>100 call sessions)
- [ ] Crash rate < 1%, call success rate > 95%

---

*Analyzed using [Skill_Seekers](https://github.com/yusufkaraaslan/Skill_Seekers) workflow pipeline.*
