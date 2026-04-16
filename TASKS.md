# JyotishConnect — Task Board (Kiro-style)

> **Legend:** ✅ Done · 🔴 Critical · 🟠 High · 🟡 Medium · ⬜ Pending
>
> Last updated: 2026-04-16 (session 5)  
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
| PM-01 | Astrologer earnings model (`astrologer_earnings` table, payout tracking) | Pre-launch |
| PM-02 | Admin dashboard UI (availability toggle, user list, revenue overview) | Post-launch |
| PM-03 | Wallet custom top-up amount (in addition to ₹100/500/1000 chips) | Medium |
| PM-04 | Push notifications (astrologer online, call incoming) | Post-launch |
| PM-05 | Astrologer profile page (bio, specializations, photo) | Medium |
| DEV-01 | Global 401 handler in Flutter router → auto redirect to `/login` | Medium |
| DEV-02 | Call history pagination (cursor-based, replace hardcoded LIMIT 50) | Low |
| TASK-06 | Flutter tests — full run on device/emulator (no SDK locally) | On device |
