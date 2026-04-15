# JyotishConnect — Task Board (Kiro-style)

> **Legend:** ✅ Done · 🔴 Critical · 🟠 High · 🟡 Medium · ⬜ Pending
>
> Last updated: 2026-04-15 (session 3)  
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
**Status:** ⬜ Pending — pre-launch, no urgency yet

**Steps:**
- [ ] 11.1 Add `refresh_tokens` table (id, user_id, token_hash, expires_at, revoked)
- [ ] 11.2 `POST /auth/login` — issue short-lived access token (15 min) + refresh token (30d, stored in DB)
- [ ] 11.3 `POST /auth/refresh` — validates refresh token, issues new access token
- [ ] 11.4 `POST /auth/logout` — marks refresh token as revoked
- [ ] 11.5 Update Flutter to store refresh token and call `/auth/refresh` on 401
- [ ] 11.6 Tests for all three endpoints

---

### TASK-13 · Migrate MCP servers to ToolHive (credential security)
**Files:** `.mcp.json`  
**Status:** ⬜ Pending  
**Why:** Live Razorpay credentials are hardcoded in `.mcp.json` args (Base64-encoded).

**Steps:**
- [ ] 13.1 Install ToolHive: `curl -fsSL https://github.com/stacklok/toolhive/releases/latest/download/install.sh | sh`
- [ ] 13.2 Move credentials to env/secrets store
- [ ] 13.3 Register MCP servers via ToolHive with `--env` injection
- [ ] 13.4 Update `.mcp.json` to use `thv run`
- [ ] 13.5 Verify MCP servers connect; confirm no creds in `.mcp.json`

---

## Completed ✅

| Task | Description | Issue |
|------|-------------|-------|
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

## Priority Order for Next Session

```
TASK-10   Rate limit hardening on auth endpoints       (~30 min)
TASK-06   Flutter unit tests under test/               (needs device)
TASK-13   ToolHive MCP credential isolation            (~30 min)
TASK-11   Refresh token pattern                        (pre-launch)
```
