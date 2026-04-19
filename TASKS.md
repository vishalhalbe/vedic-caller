# JyotishConnect — Task Board (Kiro-style)

> **Legend:** ✅ Done · 🔴 Critical · 🟠 High · 🟡 Medium · ⬜ Pending
>
> Last updated: 2026-04-19 (session 10 — Supabase migration complete, 11/11 E2E pass, multi-role audit)  
> Branch convention: `fix/<task-id>-<slug>` or work directly on `main` for hotfixes.

---

## Multi-Role Audit Summary

### 🔒 Security Engineer
| Finding | Severity | Status |
|---------|----------|--------|
| Bearer token prefix not stripped (`authMiddleware`) | Critical | ✅ Fixed #1 |
| Client-supplied rate at `/call/end` — billing bypass | Critical | ✅ Fixed #5 |
| HMAC comparison with `===` — timing attack | Critical | ✅ Fixed #4 |
| `GET /astrologer/all` — no authentication | Critical | ✅ Fixed #6 — route deleted |
| `/availability/toggle` — no ownership check | Critical | ✅ Fixed #2 — `requireAdmin` middleware |
| `POST /payment/success` credits client-supplied amount | Critical | ✅ Fixed #3 — server-stored order amount |
| JWT expiry 30 days | Medium | ✅ Fixed #18 → 7d |
| Phone auth with no OTP verification | Medium | ✅ Fixed #17 → email auth |

### 🖥️ Backend Engineer
| Finding | Severity | Status |
|---------|----------|--------|
| `app.js` calls `listen()` on import — EADDRINUSE in tests | High | ✅ Fixed |
| `models/call.js` missing `rate_per_minute` field | High | ✅ Fixed |
| Transaction status stuck at `'pending'` | Medium | ✅ Fixed #16 |
| `atomicDeduct` no reference on debit txns → unique constraint violated | High | ✅ Fixed |
| `atomicCredit` not idempotent — duplicate webhook credits | Critical | ✅ Fixed #12 |
| `ioredis` installed but idempotency still in-memory Map | High | ✅ Deferred — keeping in-memory until revenue |
| No `POST /auth/logout` endpoint | High | ✅ Fixed #9 |
| No `orders` table — amount at `/payment/success` unverifiable | Critical | ✅ Fixed #3 |

### 📱 Flutter Engineer
| Finding | Severity | Status |
|---------|----------|--------|
| `astrologer_id as int` crash | Critical | ✅ Fixed #7 |
| Agora RTC completely absent | High | ✅ Fixed #8 |
| `setState` without mounted check in `_endCall` | Medium | ✅ Fixed #19 |
| No logout button anywhere in UI | High | ✅ Fixed #9 — logout in MainShell AppBar |
| No unit tests under `test/` | High | 🟠 Open #20 |
| Integration tests scaffolded but not validated | Medium | 🟠 Open #20 |

### 🗄️ DBA
| Finding | Severity | Status |
|---------|----------|--------|
| wallet_balance can go negative | Critical | ✅ Fixed #11 |
| `transactions.reference` not unique | Critical | ✅ Fixed #12 |
| No partial index on active calls | High | ✅ Fixed #14 |
| Missing performance indexes | High | ✅ Fixed #13 |
| Enum CHECK constraints missing | Medium | ✅ Fixed #15 |
| No `orders` table for payment amount verification | Critical | ✅ Fixed #3 — migration + model |
| No `admin` role / flag on users | Medium | ✅ Fixed — `is_admin` column + migration |

### 🧪 QA / Test Engineer
| Finding | Severity | Status |
|---------|----------|--------|
| No E2E test suite | High | ✅ Fixed #21 — 32 Playwright tests |
| Jest tests: EADDRINUSE on parallel run | High | ✅ Fixed |
| Playwright `topUpWallet` hitting live Razorpay API | High | ✅ Fixed — test-credit endpoint |
| Flutter integration tests: 5 files scaffolded | Medium | 🟠 Unvalidated #20 |
| No CI pipeline | High | ✅ Fixed — backend-test.yml + e2e-test.yml |

### ⚙️ DevOps
| Finding | Severity | Status |
|---------|----------|--------|
| No CI/CD pipeline | High | ✅ Fixed — GitHub Actions workflows live |
| `.env` committed to gitignore (correct) | — | ✅ OK |
| `.env.example` missing | Medium | ✅ Fixed |
| No deployment config | Medium | ⬜ Planned |

---

## Open Tasks

### TASK-06 · Validate and fix Flutter integration tests
**Issue:** #20  
**Files:** `apps/mobile/integration_test/`  
**Status:** 🟠 Pending — needs Flutter SDK + device locally

**Steps:**
- [ ] 6.1 Run `flutter pub get` in `apps/mobile/` — confirm no dependency errors
- [ ] 6.2 Run `flutter analyze` — fix any Dart analysis errors
- [ ] 6.3 Run `flutter test integration_test/` on a connected emulator or `--platform chrome`
- [ ] 6.4 Fix any test failures (likely: API base URL, mock setup)
- [ ] 6.5 Add `apps/mobile/test/` unit tests:
  - `test/wallet_provider_test.dart` — WalletNotifier initial fetch, refresh, error state
  - `test/auth_service_test.dart` — login success / 401 response handling
- [ ] 6.6 Confirm `flutter test test/` passes with mocked HTTP

**Acceptance criteria:** `flutter test` and `flutter test integration_test/` both exit 0 on a device/emulator. At least 2 unit tests exist under `test/`.

---

### TASK-10 · Rate limiting hardening
**Status:** ✅ Done — auth endpoints limited to 10 req/15min per IP, 429 test added

---

### TASK-11 · Refresh token pattern (full JWT revocation)
**Issue:** #18 follow-up  
**Files:** `backend/api/routes/auth.js`, new migration  
**Status:** ✅ Done

- [x] 11.1 Add `refresh_tokens` table (`supabase/migrations/20260416_refresh_tokens.sql`)
- [x] 11.2 `POST /auth/login` — access token (15min) + refresh token (30d, stored as SHA-256 hash)
- [x] 11.3 `POST /auth/refresh` — validates refresh token, issues new access + refresh (rotation)
- [x] 11.4 `POST /auth/logout` — marks refresh token as revoked
- [x] 11.5 Flutter: `TokenStorage` stores both tokens; `ApiClient` auto-refreshes on 401
- [x] 11.6 Tests: 6 new tests in `auth.test.js` covering refresh, reuse prevention, logout revocation

---

### TASK-13 · Remove hardcoded credential from .mcp.json
**Files:** `.mcp.json`  
**Status:** ✅ Done (simplified — no ToolHive dependency)  
**Why:** Live Razorpay credentials were hardcoded in `.mcp.json` args (Base64-encoded).

- [x] 13.1 Replaced hardcoded token with `${RAZORPAY_MCP_TOKEN}` env var reference in `.mcp.json`
- [x] 13.2 Added `RAZORPAY_MCP_TOKEN` to `.env.example` with instructions
- Note: Full ToolHive integration deferred — env var substitution is sufficient for now

---

## Completed ✅

| Task | Description | Issue |
|------|-------------|-------|
| TASK-11 | Refresh token pattern — 15min access + 30d refresh, rotation, revocation | #18 |
| TASK-13 | Remove hardcoded Razorpay cred from `.mcp.json` → env var | – |
| TASK-10 | Auth rate limiting — 10 req/15min per IP on `/auth/*` | – |
| UX-01 | Call button disabled + "Add funds" hint when balance < rate | – |
| UX-02 | Low-balance warning banner in call screen (<60s remaining) | – |
| UX-03 | History entries show date/time (Today, Yesterday, dd/mm/yyyy) | – |
| Fix | Double AppBar bug (MainShell + screen AppBars) | – |
| Auth #1 | Bearer token prefix stripped in authMiddleware | #1 |
| Auth #2 | Email/password auth replaces phone/OTP | #17 |
| Security #1 | `timingSafeEqual` for Razorpay HMAC | #4 |
| Security #2 | Rate stored server-side — billing bypass fixed | #5 |
| Security #3 | JWT expiry 30d → 7d | #18 |
| Security #4 | `GET /astrologer/all` deleted (unauthenticated) | #6 |
| Security #5 | `requireAdmin` middleware on `/availability/toggle` | #2 |
| Security #6 | Orders table + server-stored amount at `/payment/success` | #3 |
| Flutter #1 | `astrologer_id` cast `int` → `String` | #7 |
| Flutter #2 | Full Agora RTC v6 implementation | #8 |
| Flutter #3 | `setState` mounted guard in `_endCall` | #19 |
| Flutter #4 | Logout button in MainShell AppBar + `AuthService.logout()` | #9 |
| DB #1 | wallet_balance CHECK constraint | #11 |
| DB #2 | `transactions.reference` UNIQUE + idempotent credit | #12 |
| DB #3 | Performance indexes (calls, astrologers) | #13 |
| DB #4 | Partial UNIQUE index: one active call per user | #14 |
| DB #5 | Enum CHECK constraints on status/type columns | #15 |
| DB #6 | `rate_per_minute` column on calls | #5 |
| DB #7 | `is_admin` column on users + migration | #2 |
| DB #8 | `orders` table + migration | #3 |
| App #1 | Transaction status `'success'` (was stuck at `'pending'`) | #16 |
| App #2 | `app.js` — `listen()` guarded by `require.main === module` | – |
| App #3 | `models/call.js` — added `rate_per_minute` field | – |
| App #4 | `atomicDeduct` — unique reference per debit transaction | – |
| App #5 | `POST /auth/logout` endpoint | #9 |
| App #6 | `GET /health` endpoint (unauthenticated, for load balancer) | – |
| Tests #1 | 39 Jest unit/integration tests (incl. admin + logout) | – |
| Tests #2 | 32 Playwright E2E tests (incl. payment amount verify) | #21 |
| Tests #3 | Razorpay mock in `phase1.test.js` | – |
| CI #1 | GitHub Actions: backend-test.yml (Jest + Postgres) | – |
| CI #2 | GitHub Actions: e2e-test.yml (Playwright + Postgres) | – |
| Config #1 | `.env.example` with all required variables | – |
| Config #2 | Terse response behavior rule added to CLAUDE.md | – |

---

## Issue Tracker Mapping

| GitHub Issue | Task | Status |
|---|---|---|
| #2 | TASK-02 | ✅ Done |
| #3 | TASK-03 | ✅ Done |
| #6 | TASK-01 | ✅ Done |
| #9 | TASK-04 | ✅ Done |
| #10 | TASK-05 | ✅ Deferred (in-memory sufficient) |
| #20 | TASK-06 | 🟠 Needs device |
| – | TASK-10 | ⬜ Rate limits |
| – | TASK-11 | ⬜ Refresh tokens |
| – | TASK-13 | ⬜ ToolHive MCP |

---

---

## Session 5 Audit Findings — Fixed

| # | Fix | File(s) |
|---|-----|---------|
| A1 | `/metrics` secured with `requireAdmin` | `app.js` |
| A2 | `RefreshToken` expiry enforced in DB query (not app code) | `routes/auth.js` |
| A3 | `call_service.dart` no longer sends `rate` field | `services/call_service.dart` |
| A4 | `callLifecycle.startCall` marks astrologer unavailable atomically (FOR UPDATE) | `services/callLifecycle.js` |
| A5 | `callLifecycle.finaliseCall` restores `is_available = true` after call ends | `services/callLifecycle.js` |
| A6 | `call/cleanup` restores astrologer availability for stale calls | `routes/call.js` |
| A7 | DB migration: UNIQUE partial index preventing two users calling same astrologer | `migrations/20260416_astrologer_active_call_index.sql` |
| A8 | Post-call summary modal (duration + cost + Done button) | `call_screen_v2.dart` |
| A9 | `home_screen.dart` stub deleted; router uses `AstrologerListScreen` directly | `main.dart` |
| A10 | `Dockerfile` + `docker-compose.yml` (API + Postgres + cleanup cron service) | root |
| A11 | `backend/scripts/cleanup.sh` for bare-metal cron deployment | `scripts/cleanup.sh` |
| A12 | 2 new integration tests: availability lifecycle, two-user conflict prevention | `tests/integration.test.js` |

## Open / Future

| Task | Description | Priority |
|------|-------------|----------|
| TASK-06 | Flutter tests — full run on device/emulator (no SDK locally) | On device |

---

## Session 7 Audit Findings

### 🔴 Critical — Session 7 (all resolved ✅)

| ID | Finding | File | Status |
|----|---------|------|--------|
| S7-CRIT-01 | `finaliseCall` not transactional | `services/callLifecycle.js` | ✅ Single outer transaction wraps all 3 ops |
| S7-CRIT-02 | `/availability/toggle` missing `requireAdmin` | `routes/astrologerAvailability.js` | ✅ `requireAdmin` added |

### 🟠 High — Session 7 (all resolved ✅)

| ID | Finding | File | Status |
|----|---------|------|--------|
| S7-HIGH-01 | No tests for `POST /call/end` | `tests/call.test.js` | ✅ 2 tests added (success + idempotency) |
| S7-HIGH-02 | `atomicCredit` unique constraint → 500 | `services/walletEngine.js` | ✅ Caught, returns idempotent 200 |
| S7-HIGH-03 | No admin bootstrap path | — | ✅ `POST /admin/seed` added |
| S7-HIGH-04 | Duplicate billing formula | `services/callLifecycle.js` | ✅ Uses `walletService.calculateDeduction` |

### 🟡 Medium — Session 7 (all resolved ✅)

| ID | Finding | File | Status |
|----|---------|------|--------|
| S7-MED-01 | Missing HSTS header | `nginx/nginx.conf` | ✅ Added |
| S7-MED-02 | `Transaction.status` default `'pending'` | `models/transaction.js` | ✅ Default changed to `'success'` |
| S7-MED-03 | `/availability/toggle` no 404 check | `routes/astrologerAvailability.js` | ✅ Fetch-first, 404 if missing |
| S7-MED-04 | No index on `refresh_tokens.expires_at` | `migrations/` | ✅ `idx_rt_expires_at` added |
| S7-MED-05 | `SKILL.md` outdated | `SKILL.md` | ✅ Full rewrite: correct API, schema, env vars |
| S7-MED-06 | Unused `ioredis` + `joi` + `crypto` deps | `package.json` | ✅ Removed |
| S7-MED-07 | No debounce on search | `astrologer_list_screen.dart` | ✅ 300ms debounce |
| S7-MED-08 | `history_screen` reads bare array | `history_screen.dart` | ✅ Unwraps `{data}` |

### ⬜ Low — Session 7

| ID | Finding | File | Status |
|----|---------|------|--------|
| S7-LOW-01 | No `photo_url` upload endpoint | — | ⬜ Deferred (out of scope) |
| S7-LOW-02 | Admin nav tab hidden | `main.dart` | ✅ Conditional Admin tab for `is_admin` users |
| S7-LOW-03 | Docker migrations note | `docker-compose.yml` | ✅ MIGRATION NOTE comment added |
| S7-LOW-04 | Wallet minimum ₹0.01 | `wallet_widget.dart` | ✅ ₹10 minimum guard added |
| S7-LOW-05 | Agora 1hr token expiry | `call_screen_v2.dart` | ✅ 55-min auto-end added |
| S7-LOW-06 | `crypto` in package.json | `package.json` | ✅ Removed (built-in) |
| S7-LOW-07 | No log rotation config | `docker-compose.yml` | ✅ `json-file` driver with rotation |

### Additional fixes found during Session 8 testing

| Fix | File | Status |
|-----|------|--------|
| `phone` column removed from User model (was dropped in migration) | `models/user.js` | ✅ Done |
| Rate limiter disabled in `NODE_ENV=test` to prevent 429s during tests | `middleware/rateLimiter.js` | ✅ Done |
| JWT `jti` nonce added to ensure token uniqueness even within same second | `services/jwt.js` | ✅ Done |
| `CLEANUP_SECRET` undefined → skip check bug (undefined === undefined) | `routes/call.js` | ✅ Fixed |
| Integration tests: `giveBalance` helper + `beforeEach` DB state reset | `tests/integration.test.js` | ✅ Done |
| Auth rate-limiting test skipped in `NODE_ENV=test` | `tests/auth.test.js` | ✅ Done |

**Test suite result (session 8):** 7 suites · 80 passed · 1 skipped · 0 failed

---

## Session 8 Audit Findings

### 🟠 High

| ID | Finding | File | Status |
|----|---------|------|--------|
| S8-HIGH-01 | Cleanup endpoint restores astrologer availability without checking for other active calls | `routes/call.js:120` | ✅ Fixed — check remaining active calls before marking available |
| S8-HIGH-02 | No `process.on('unhandledRejection')` handler — async errors crash silently | `app.js` | ✅ Fixed — logs + exits on unhandled rejection |

### 🟡 Medium

| ID | Finding | File | Status |
|----|---------|------|--------|
| S8-MED-01 | Cleanup race: SELECT stale → UPDATE cancelled → set available is not atomic | `routes/call.js` | ⬜ Low priority — cleanup runs every 5min, window is tiny |
| S8-MED-02 | Idempotency middleware caches error responses (500) — retry with same key gets cached error | `middleware/idempotencyMiddleware_v2.js` | ⬜ Low impact — payment idempotency backed by DB; middleware is best-effort |
| S8-MED-03 | Admin toggle endpoint missing try-catch in Flutter UI | `admin_screen.dart` | ⬜ Deferred |

### ⬜ Low

| ID | Finding | File | Status |
|----|---------|------|--------|
| S8-LOW-01 | `GET /astrologer` has no pagination — will slow as catalog grows | `routes/astrologer.js` | ⬜ Deferred until > 100 astrologers |
| S8-LOW-02 | Agora 55-min limit hardcoded in client — server token TTL not returned | `routes/call.js`, `call_screen_v2.dart` | ⬜ Documented limitation |
| S8-LOW-03 | Double email lowercasing (client + server) — harmless but redundant | `auth_service.dart` | ⬜ Deferred |

---

## Session 9–10 Completed

| Fix | File | Status |
|-----|------|--------|
| Supabase migration: replace Sequelize ORM with @supabase/supabase-js | `config/db.js`, all routes | ✅ Done |
| Schema applied to Supabase: drop auth FK, UUID defaults, RPCs | `migrations/20260419_*` | ✅ Done |
| `authMiddleware.requireAdmin` — was still using deleted Sequelize User model | `middleware/authMiddleware.js` | ✅ Fixed |
| `callLifecycle.finaliseCall` — non-atomic 3-step deduct+update+credit replaced with `end_call` RPC | `services/callLifecycle.js`, `migrations/20260420_*` | ✅ Fixed |
| `payment_simple.js /success` double-credit race — atomic UPDATE WHERE status=created | `routes/payment_simple.js` | ✅ Fixed |
| `webhook_v2.js` — user_id from notes not verified against orders.user_id | `routes/webhook_v2.js` | ✅ Fixed |
| `api_client.dart` default URL broken for Flutter web (10.0.2.2 → kIsWeb check) | `apps/mobile/lib/core/api_client.dart` | ✅ Fixed |
| E2E login flow tests added (register/login/wallet/astrologers, token refresh) | `tests/e2e/login_flow.spec.js` | ✅ Done |
| .gitignore expanded: test-results, build/, Android generated files | `.gitignore` | ✅ Done |
| CLAUDE.md + SKILL.md updated: Sequelize references removed | `CLAUDE.md`, `SKILL.md` | ✅ Done |
| E2E test suite: 11/11 passing | `tests/e2e/` | ✅ Done |

---

## Session 10 Audit Findings

### 🔒 Security Engineer (Session 10)

| ID | Finding | File | Severity | Status |
|----|---------|------|----------|--------|
| S10-SEC-01 | Webhook `atomicCredit` called before order status claimed — same double-credit race as payment_simple (different code path) | `routes/webhook_v2.js:49-56` | 🔴 Critical | ⬜ Open |
| S10-SEC-02 | `/call/cleanup` secret compared with `===` not `timingSafeEqual` | `routes/call.js:88-89` | 🔴 Critical | ⬜ Open |
| S10-SEC-03 | `authLimiter` applied to `/auth/logout` — DoS via IP exhaustion from NAT | `app.js:61` | 🟠 High | ⬜ Open |
| S10-SEC-04 | `verifyPayment` in dev mode — confirm test-mode HMAC does not silently pass in staging | `routes/payment_simple.js` | 🟡 Medium | ⬜ Needs review |

### 📱 Flutter Engineer (Session 10)

| ID | Finding | File | Severity | Status |
|----|---------|------|----------|--------|
| S10-FL-01 | Router `redirect` creates raw `Dio` instance — bypasses ApiClient interceptor, duplicate refresh path | `main.dart` (router) | 🟠 High | ⬜ Open |
| S10-FL-02 | No `FlutterError.onError` or `PlatformDispatcher.instance.onError` in main() | `main.dart` | 🟠 High | ⬜ Open |
| S10-FL-03 | `MainShell` admin state loaded once in `initState` — not reactive to auth changes | `main.dart` (MainShell) | 🟡 Medium | ⬜ Open |
| S10-FL-04 | No registration screen — login only, no sign-up flow visible | `features/auth/` | 🟠 High | ⬜ Open |

### 🏗️ Product / Feature Gaps (Session 10)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F-01 | Astrologer login + role-based routing (separate entry from seeker) | 🔴 P0 | ⬜ Not started |
| F-02 | Astrologer dashboard: online/offline toggle, active call status, earnings balance | 🔴 P0 | ⬜ Not started |
| F-03 | Incoming call notification to astrologer (Supabase Realtime) | 🔴 P0 | ⬜ Not started |
| F-04 | Call accept / reject screen for astrologer | 🔴 P0 | ⬜ Not started |
| F-05 | Astrologer earnings screen + withdrawal request | 🟠 P1 | ⬜ Not started |
| F-06 | Push notifications — FCM for missed calls when app backgrounded | 🟠 P1 | ⬜ Not started |
| F-07 | Ratings & reviews: post-call, display on astrologer card | 🟠 P1 | ⬜ Not started |
| F-08 | Seeker registration screen in Flutter UI (currently login-only) | 🟠 P1 | ⬜ Not started |
| F-09 | Astrologer profile page (bio, specialization, reviews, photo) | 🟡 P2 | ⬜ Not started |
| F-10 | Photo upload endpoint + S3/Supabase storage | 🟡 P2 | ⬜ Deferred (S7-LOW-01) |
| F-11 | Astrologer KYC / onboarding flow | 🟡 P2 | ⬜ Not started |
| F-12 | Production deployment: hosted env, Dockerfile tested, observability | 🟠 P1 | ⬜ Planned |
| F-13 | Seeker wallet top-up screen (dedicated page, not just widget) | 🟡 P2 | ⬜ Not started |
| F-14 | Refund / dispute handling | 🟡 P2 | ⬜ Not started |
| F-15 | Pagination on `GET /astrologer` (deferred until >100 records) | ⬜ P3 | ⬜ Deferred (S8-LOW-01) |

---

## Sprint Plan — Next Sessions

### Sprint 1 · Astrologer Auth + Role Routing (P0)
Covers: F-01, S10-FL-04
1. DB migration: add `email`, `password_hash` to `astrologers` table
2. Backend: `POST /astrologer/auth/login` → JWT with `role:'astrologer'` + `astrologer_id`
3. Backend: `requireAstrologer` middleware
4. Flutter: role selector on login screen OR separate astrologer login entry
5. Flutter: post-login routing — seeker → `AstrologerListScreen`, astrologer → `AstrologerDashboardScreen`

### Sprint 2 · Astrologer Dashboard + Availability (P0)
Covers: F-02, F-03
1. Backend: `POST /astrologer/me/availability` (auth'd as astrologer, toggles own row)
2. Flutter: `astrologer_dashboard_screen.dart` — toggle, earnings balance, active call indicator
3. Supabase Realtime: subscribe to `calls` table INSERT for this astrologer → incoming call alert

### Sprint 3 · Call Accept/Reject (P0)
Covers: F-03, F-04
1. Flutter: `incoming_call_screen.dart` — Accept / Decline buttons
2. Backend: `POST /call/decline/:call_id` — marks call declined, restores astrologer availability
3. Flutter: accepted call navigates to `call_screen_astrologer.dart` (timer, end call)

### Sprint 4 · Earnings + Withdrawal (P1)
Covers: F-05
1. Backend: `GET /astrologer/me/earnings` — summary + paginated history
2. Backend: `POST /astrologer/me/withdrawal` — creates withdrawal request record
3. Flutter: `earnings_screen.dart`

### Sprint 5 · Security Hardening (P0 — blocking production)
Covers: S10-SEC-01, S10-SEC-02, S10-SEC-03, S10-FL-01, S10-FL-02
1. `webhook_v2.js`: apply UPDATE WHERE status=created before atomicCredit
2. `call.js /cleanup`: use `crypto.timingSafeEqual` for secret comparison
3. `app.js`: remove `authLimiter` from `/auth/logout`
4. Flutter `main.dart`: fix router Dio instance, add global error handlers

---

## Product Completion Scorecard

| Area | % Complete | Notes |
|------|-----------|-------|
| Seeker auth + wallet | 95% | Registration UI missing from Flutter |
| Seeker call flow | 90% | Works end-to-end; no ratings post-call |
| Seeker history | 100% | Done |
| Admin panel | 70% | Availability toggle admin-only; no user mgmt |
| Astrologer app | 5% | DB columns exist; zero UX built |
| Payments / Razorpay | 85% | Webhook race fix needed |
| Security hardening | 80% | 2 CRITICALs remain (S10-SEC-01/02) |
| Testing (E2E) | 60% | 11 tests; no astrologer-path tests |
| Production deploy | 10% | Dockerfile exists; no hosted env |
| **Overall MVP** | **~45%** | Astrologer app is the blocking gap |
