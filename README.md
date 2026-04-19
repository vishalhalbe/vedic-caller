# JyotishConnect (Vedic Caller)

Vedic astrology voice consulting platform — seekers book real-time voice calls with astrologers, billed per minute with atomic wallet deductions.

**Branch:** `claude/analyze-skill-seekers-gGKzr`  
**Status:** Seeker flows complete · Astrologer app in progress · 11/11 E2E passing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Flutter (Dart) — web + Android |
| Backend | Node.js + Express |
| Database | PostgreSQL via Supabase (`@supabase/supabase-js`) |
| Voice | Agora RTC |
| Payments | Razorpay |
| E2E Tests | Playwright |

---

## Project Structure

```
vedic-caller/
├── apps/mobile/          # Flutter app (seeker + admin UI)
│   └── lib/features/
│       ├── auth/         # login_screen_v2.dart
│       ├── astrologer/   # astrologer_list_screen.dart
│       ├── call/         # call_screen_v2.dart
│       ├── history/      # history_screen.dart
│       ├── wallet/       # wallet_widget.dart
│       └── admin/        # admin_screen.dart
├── backend/api/          # Express API (PORT 3000)
│   ├── routes/           # auth, call, wallet, payment, astrologer, admin
│   ├── services/         # callLifecycle, walletEngine, billingEngine
│   ├── middleware/       # authMiddleware, rateLimiter
│   └── tests/e2e/        # Playwright tests
├── supabase/migrations/  # Schema + RPCs applied to Supabase
├── TASKS.md              # Full task board + audit findings
├── SKILL.md              # Architecture reference + API docs
└── CLAUDE.md             # Claude Code guide for this project
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

### Prerequisites
Both servers must be running (backend on :3000, Flutter web on :8282).

```bash
# Terminal 1 — backend
cd backend/api && node app.js

# Terminal 2 — Flutter web
cd apps/mobile && npx serve -p 8282 build/web

# Terminal 3 — run tests
cd backend/api
npx playwright test --reporter=list
```

### Current Results
```
11 passed (42s)

flutter_ui.spec.js   (8 tests)
  ✓ app title is JyotishConnect
  ✓ Flutter view renders and is visible
  ✓ no fatal JS errors on load
  ✓ Flutter semantics placeholder is present
  ✓ renders at mobile viewport (375x812)
  ✓ renders at tablet viewport (768x1024)
  ✓ renders at desktop viewport (1280x800)
  ✓ flutter-view appears within 40 seconds

login_flow.spec.js   (3 tests)
  ✓ login flow reaches backend and receives JWT
  ✓ backend login API works end-to-end
  ✓ token refresh works
```

### Screenshots

Screenshots are saved to `backend/api/test-results/` after each run:

| File | What it shows |
|------|--------------|
| `test-results/01-app-loaded.png` | Flutter app loaded in browser |
| `test-results/login-01-loaded.png` | Login screen on first load |
| `test-results/login-02-login-screen.png` | Login screen after Flutter boot |
| `test-results/viewport-mobile-375.png` | App at 375×812 (mobile) |
| `test-results/viewport-tablet-768.png` | App at 768×1024 (tablet) |
| `test-results/viewport-desktop-1280.png` | App at 1280×800 (desktop) |

> Screenshots for **failed** tests are saved automatically under  
> `backend/api/test-results/<test-name-slug>/test-failed-1.png`  
> Videos of failed tests: `test-results/<test-name-slug>/video.webm`

### HTML Report

After every run Playwright generates a full HTML report:

```bash
cd backend/api
npx playwright show-report    # opens browser at localhost:9323
```

Report is at `backend/api/playwright-report/index.html` — open directly in any browser.

### Run a single test file
```bash
cd backend/api
npx playwright test tests/e2e/login_flow.spec.js --reporter=list
npx playwright test tests/e2e/flutter_ui.spec.js --reporter=list
```

### Run with browser visible (headed mode)
```bash
cd backend/api
npx playwright test --headed
```

---

## Environment Variables

Copy `backend/api/.env.example` and fill in:

```
PORT=3000
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=sb_publishable_...
JWT_SECRET=<min 48 hex chars>
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
ADMIN_SEED_SECRET=...
CLEANUP_SECRET=...
```

---

## Key API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register seeker |
| POST | `/auth/login` | — | Login, returns JWT + refresh token |
| POST | `/auth/refresh` | — | Rotate refresh token |
| POST | `/auth/logout` | JWT | Revoke refresh token |
| GET | `/astrologer` | — | List astrologers (filter, search) |
| GET | `/wallet/balance` | JWT | Get wallet balance |
| POST | `/call/start` | JWT | Start call with astrologer |
| POST | `/call/end` | JWT | End call, deduct wallet |
| GET | `/call/history` | JWT | Paginated call history |
| POST | `/payment/create-order` | JWT | Create Razorpay order |
| POST | `/payment/success` | JWT | Confirm payment, credit wallet |
| POST | `/webhook/razorpay` | HMAC | Razorpay webhook handler |
| GET | `/health` | — | Health + DB connectivity check |

Full API reference: see `SKILL.md`.

---

## Database

Supabase project: `rddxemcvddhicylsmpfb`

Migrations in `supabase/migrations/` — applied in order:
- `20260419_vedic_caller_full_schema.sql` — full schema, RLS, RPCs
- `20260420_end_call_rpc.sql` — atomic `end_call` function

Key PostgreSQL RPCs (called via `supabase.rpc()`):
- `wallet_deduct` — FOR UPDATE lock + deduct + insert transaction
- `wallet_credit` — idempotent credit with reference key
- `start_call` — atomic astrologer lock + call record creation
- `end_call` — atomic deduct + call update + astrologer credit restore

---

## What's Built / What's Next

See `TASKS.md` for the full board. Summary:

| Area | Status |
|------|--------|
| Seeker auth, wallet, call, history | ✅ Complete |
| Admin panel (astrologer management) | ✅ Partial |
| Astrologer login + dashboard | 🔴 Sprint 1 — not started |
| Incoming call accept/reject | 🔴 Sprint 3 — not started |
| Push notifications (FCM) | 🟠 Sprint 6 |
| Production deployment | 🟠 Planned |
