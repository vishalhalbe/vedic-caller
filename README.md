# JyotishConnect (Vedic Caller)

Vedic astrology voice consulting platform — seekers book real-time voice calls with astrologers, billed per minute with atomic wallet deductions.

**Live API:** https://vedic-caller.onrender.com  
**Branch:** `claude/analyze-skill-seekers-gGKzr` → merged to `main`  
**E2E Tests:** 101/101 passing · **MVP:** ~96%

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Flutter (Dart) — web + Android |
| Backend | Node.js + Express |
| Database | PostgreSQL via Supabase (`@supabase/supabase-js`) |
| Voice | Agora RTC v6 |
| Payments | Razorpay |
| Deploy | Render (free tier, Singapore) |
| E2E Tests | Playwright |

---

## Project Structure

```
vedic-caller/
├── apps/mobile/               # Flutter app (seeker + astrologer + admin)
│   ├── lib/features/
│   │   ├── auth/              # login_screen_v2.dart — role toggle, register
│   │   ├── astrologer/        # list, profile, dashboard, earnings screens
│   │   ├── call/              # call_screen_v2.dart, incoming_call_screen.dart
│   │   ├── history/           # history_screen.dart
│   │   └── wallet/            # wallet_widget.dart, wallet_topup_screen.dart
│   └── test/                  # Flutter unit tests
├── backend/api/               # Express API (PORT 3000)
│   ├── routes/                # auth, call, wallet, payment, astrologer, admin, webhook
│   ├── services/              # callLifecycle, walletEngine, walletService, jwt
│   ├── middleware/            # authMiddleware, rateLimiter, logger, idempotency
│   └── tests/e2e/             # 101 Playwright tests (9 spec files)
├── supabase/migrations/       # 16 migrations — schema, RLS, RPCs
├── .github/workflows/         # backend-test.yml, e2e-test.yml, deploy.yml
├── render.yaml                # Render deploy config
├── docker-compose.yml         # Local dev: db + api + cleanup + nginx
├── DEPLOY.md                  # Full deployment runbook
├── TASKS.md                   # Sprint board + audit findings
├── STATUS.md                  # Multi-role project status review
└── SKILL.md                   # Architecture reference + full API docs
```

---

## Quick Start

### 1. Backend
```bash
cd backend/api
npm install
cp .env.example .env      # fill in SUPABASE_URL, SUPABASE_KEY, JWT_SECRET, etc.
node app.js               # starts on http://localhost:3000
```

Health check: `curl http://localhost:3000/health`

### 2. Flutter Web
```bash
cd apps/mobile
flutter pub get
flutter build web --release
npx serve -p 8282 build/web   # serves on http://localhost:8282
```

### 3. Flutter Mobile (Android emulator)
```bash
cd apps/mobile
flutter run               # connects to backend at 10.0.2.2:3000 automatically
```

---

## Running E2E Tests

```bash
cd backend/api
NODE_ENV=test npx playwright test --reporter=list
# → 101 passed
```

Playwright manages the backend server automatically (`webServer` in `playwright.config.js`). Flutter web must be running on `:8282` for UI tests.

### Screenshots
All 101 tests produce screenshots in `backend/api/test-results/`:
- API tests: JSON rendered as styled HTML → `<test-name>.png`
- Flutter UI tests: `ui-*.png` (12 screenshots across 15 user stories)

### HTML Report
```bash
cd backend/api && npx playwright show-report
```

---

## Deployment

Deployed to **Render** at https://vedic-caller.onrender.com

See [DEPLOY.md](DEPLOY.md) for full runbook. Quick summary:

- `render.yaml` — Render service config (Node runtime, Singapore, auto-deploy on push to main)
- `.github/workflows/deploy.yml` — triggers Render deploy hook on push
- Env vars set in Render dashboard (SUPABASE_URL, JWT_SECRET, RAZORPAY_*, AGORA_*, etc.)

**Pending manual steps:**
1. Set up cleanup cron at cron-job.org → `POST https://vedic-caller.onrender.com/call/cleanup` every 5 min with header `x-cleanup-secret: <CLEANUP_SECRET>`
2. Bootstrap admin → `POST https://vedic-caller.onrender.com/admin/seed`

---

## Environment Variables

Copy `backend/api/.env.example` and fill in:

```
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=sb_publishable_...
JWT_SECRET=<min 48 hex chars — openssl rand -hex 48>
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8282
CLEANUP_SECRET=...
ADMIN_SEED_SECRET=...
```

---

## Key API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register seeker |
| POST | `/auth/login` | — | Login → JWT + refresh token |
| POST | `/auth/refresh` | — | Rotate refresh token |
| POST | `/auth/logout` | JWT | Revoke refresh token |
| GET | `/astrologer` | — | List astrologers with ratings |
| GET | `/astrologer/:id` | — | Full astrologer profile |
| POST | `/astrologer/auth/register` | — | Register astrologer |
| POST | `/astrologer/auth/login` | — | Astrologer login |
| GET | `/astrologer/me` | AstroJWT | Astrologer profile + earnings |
| POST | `/astrologer/me/availability` | AstroJWT | Toggle online/offline |
| GET | `/astrologer/me/earnings` | AstroJWT | Earnings + recent calls |
| POST | `/astrologer/me/withdrawal` | AstroJWT | Request payout |
| GET | `/call/incoming` | AstroJWT | Poll for pending call |
| POST | `/call/start` | JWT | Start call → Agora channel + token |
| POST | `/call/end` | JWT | End call → atomic wallet deduction |
| POST | `/call/decline/:id` | AstroJWT | Decline incoming call |
| POST | `/call/rate` | JWT | Rate completed call (1–5 stars) |
| GET | `/callHistory` | JWT | Paginated call history |
| GET | `/wallet/balance` | JWT | Wallet balance |
| GET | `/wallet/transactions` | JWT | Paginated transaction history |
| POST | `/payment/create-order` | JWT | Create Razorpay order |
| POST | `/payment/success` | JWT | Verify + credit wallet |
| POST | `/webhook/razorpay` | HMAC | Razorpay payment.captured |
| GET | `/health` | — | Health + DB connectivity |

Full API reference: see [SKILL.md](SKILL.md).

---

## Database

Supabase project: `rddxemcvddhicylsmpfb`  
Migrations in `supabase/migrations/` — 16 files applied in order.

Key tables: `users`, `astrologers`, `calls`, `transactions`, `orders`, `withdrawal_requests`, `refresh_tokens`  
View: `astrologer_avg_ratings`  
RPC: `end_call()` — atomic deduct + update + credit in one transaction

---

## Feature Status

| Area | Status |
|------|--------|
| Seeker auth, wallet, call, history | ✅ Complete |
| Astrologer auth, dashboard, earnings | ✅ Complete |
| Incoming call flow (accept/decline) | ✅ Complete |
| Ratings & reviews | ✅ Complete |
| Astrologer profile page | ✅ Complete |
| Dedicated wallet screen | ✅ Complete |
| Razorpay payments + webhook | ✅ Complete |
| Production deploy (Render) | ✅ Live |
| E2E test suite (101 tests) | ✅ All passing |
| Supabase Realtime (replace polling) | 🟠 Sprint 11 |
| Withdrawal admin approval UI | 🟠 Sprint 10 |
| Flutter unit tests | 🟠 Sprint 9 |

See [TASKS.md](TASKS.md) for the full sprint board.
