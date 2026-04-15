# JyotishConnect — Task Board (Kiro-style)

> **Legend:** ✅ Done · 🔴 Critical · 🟠 High · 🟡 Medium · ⬜ Pending
>
> Last updated: 2026-04-15  
> Branch convention: `fix/<task-id>-<slug>` or work directly on `main` for hotfixes.

---

## Multi-Role Audit Summary

### 🔒 Security Engineer
| Finding | Severity | Status |
|---------|----------|--------|
| Bearer token prefix not stripped (`authMiddleware`) | Critical | ✅ Fixed #1 |
| Client-supplied rate at `/call/end` — billing bypass | Critical | ✅ Fixed #5 |
| HMAC comparison with `===` — timing attack | Critical | ✅ Fixed #4 |
| `GET /astrologer/all` — no authentication | Critical | 🔴 Open #6 |
| `/availability/toggle` — no ownership check | Critical | 🔴 Open #2 |
| `POST /payment/success` credits client-supplied amount | Critical | 🔴 Open #3 |
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
| `ioredis` installed but idempotency still in-memory Map | High | 🟠 Open #10 |
| No `POST /auth/logout` endpoint | High | 🟠 Open #9 |
| No `orders` table — amount at `/payment/success` unverifiable | Critical | 🔴 Open #3 |

### 📱 Flutter Engineer
| Finding | Severity | Status |
|---------|----------|--------|
| `astrologer_id as int` crash | Critical | ✅ Fixed #7 |
| Agora RTC completely absent | High | ✅ Fixed #8 |
| `setState` without mounted check in `_endCall` | Medium | ✅ Fixed #19 |
| No logout button anywhere in UI | High | 🟠 Open #9 |
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
| No `orders` table for payment amount verification | Critical | 🔴 Open #3 |
| No `admin` role / flag on users | Medium | 🔴 Needed for #2, #6 |

### 🧪 QA / Test Engineer
| Finding | Severity | Status |
|---------|----------|--------|
| No E2E test suite | High | ✅ Fixed #21 — 30 Playwright tests |
| Jest tests: EADDRINUSE on parallel run | High | ✅ Fixed |
| Playwright `topUpWallet` hitting live Razorpay API | High | ✅ Fixed — test-credit endpoint |
| Flutter integration tests: 5 files scaffolded | Medium | 🟠 Unvalidated #20 |
| No CI pipeline | High | ⬜ Planned |

### ⚙️ DevOps
| Finding | Severity | Status |
|---------|----------|--------|
| No CI/CD pipeline | High | ⬜ Planned |
| `.env` committed to gitignore (correct) | — | ✅ OK |
| No deployment config | Medium | ⬜ Planned |

---

## Sprint 1 — Critical Security (Do First) 🔴

### TASK-01 · Remove unauthenticated `/astrologer/all` endpoint
**Issue:** #6  
**File:** `backend/api/routes/astrologer.js`  
**Status:** ⬜ Pending

**Steps:**
- [ ] 1.1 Delete the `GET /all` route entirely (no current product use case requires it)
- [ ] 1.2 Verify no Flutter code calls `/astrologer/all` (search `grep -r "astrologer/all"`)
- [ ] 1.3 Add test to `call.test.js`: `GET /astrologer/all` returns 404
- [ ] 1.4 Run full Jest suite — 37+ tests pass

**Acceptance criteria:** `GET /astrologer/all` returns 404. No authenticated or unauthenticated path reaches the full astrologer list.

---

### TASK-02 · Add `is_admin` column + restrict availability toggle
**Issue:** #2  
**Files:** `supabase/migrations/`, `backend/api/routes/astrologerAvailability.js`, `backend/api/models/user.js`  
**Status:** ⬜ Pending

**Steps:**
- [ ] 2.1 Create migration `20260415_admin_flag.sql`:
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
  ```
- [ ] 2.2 Add `is_admin: { type: DataTypes.BOOLEAN, defaultValue: false }` to `models/user.js`
- [ ] 2.3 Add `requireAdmin` middleware helper in `authMiddleware.js`:
  ```js
  exports.requireAdmin = async (req, res, next) => {
    const user = await User.findByPk(req.user.id, { attributes: ['is_admin'] });
    if (!user?.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
  };
  ```
- [ ] 2.4 Apply `requireAdmin` to `POST /availability/toggle` in `astrologerAvailability.js`
- [ ] 2.5 Apply `requireAdmin` to `GET /availability/:id` if it returns sensitive data
- [ ] 2.6 Add Jest test: non-admin user gets 403 on toggle
- [ ] 2.7 Add Jest test: admin user can toggle (seed a test admin)
- [ ] 2.8 Run full Jest suite

**Acceptance criteria:** Regular users receive 403 on `/availability/toggle`. Only users with `is_admin = true` can change availability.

---

### TASK-03 · Fix payment amount mismatch — store + verify order amount
**Issue:** #3  
**Files:** `supabase/migrations/`, `backend/api/routes/payment_simple.js`, new model  
**Status:** ⬜ Pending

**Steps:**
- [ ] 3.1 Create migration `20260415_orders_table.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS orders (
    id         TEXT PRIMARY KEY,        -- Razorpay order_id
    user_id    UUID NOT NULL REFERENCES users(id),
    amount     NUMERIC(10,2) NOT NULL,
    currency   TEXT NOT NULL DEFAULT 'INR',
    status     TEXT NOT NULL DEFAULT 'created',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  ```
- [ ] 3.2 Create `backend/api/models/order.js` Sequelize model
- [ ] 3.3 Register model in `models/index.js`
- [ ] 3.4 In `POST /payment/create-order`: save order to DB after creation (or use fake order in dev)
- [ ] 3.5 In `POST /payment/success`: look up stored order, compare `storedOrder.amount` vs `parsedAmount` — reject with 400 if mismatch
- [ ] 3.6 Mark order as `'paid'` after successful credit
- [ ] 3.7 Add Playwright test: create order for ₹100, attempt success with `amount: 99999` → 400
- [ ] 3.8 Add Playwright test: correct amount → 200 and balance updated
- [ ] 3.9 Run full Jest + Playwright suite

**Acceptance criteria:** A valid signature with a mismatched amount returns 400. Only the amount from the server-stored order is credited.

---

## Sprint 2 — Auth Completeness 🟠

### TASK-04 · Implement logout (backend + Flutter)
**Issue:** #9  
**Files:** `backend/api/routes/auth.js`, `apps/mobile/lib/main.dart`, `apps/mobile/lib/features/auth/login_screen_v2.dart`  
**Status:** ⬜ Pending

**Steps:**
- [ ] 4.1 Add `POST /auth/logout` to `routes/auth.js` — for now simply returns 200 (JWT is stateless; real revocation needs Redis in TASK-06):
  ```js
  router.post('/logout', auth, (req, res) => res.json({ success: true }));
  ```
- [ ] 4.2 Add logout icon button to `MainShell` AppBar (top-right):
  ```dart
  IconButton(
    icon: const Icon(Icons.logout),
    onPressed: () async {
      await AuthService().logout();
      await TokenStorage().delete();
      ref.invalidate(walletProvider);
      if (context.mounted) context.go('/login');
    },
  )
  ```
- [ ] 4.3 Add `AuthService.logout()` method calling `POST /auth/logout`
- [ ] 4.4 Add Jest test: `POST /auth/logout` with valid token → 200; without token → 401
- [ ] 4.5 Run full Jest suite

**Acceptance criteria:** User can log out from the home screen. Token is deleted from secure storage. App redirects to login. Server endpoint exists for future blacklisting.

---

## Sprint 3 — Idempotency Hardening 🟠

### TASK-05 · Wire up Redis idempotency middleware
**Issue:** #10  
**Files:** `backend/api/config/redisClient.js` (new), `backend/api/middleware/idempotencyMiddleware_v2.js`  
**Status:** ⬜ Pending  
**Prerequisite:** Redis available at `REDIS_URL` env var (default `redis://localhost:6379`)

**Steps:**
- [ ] 5.1 Create `backend/api/config/redisClient.js`:
  ```js
  const Redis = require('ioredis');
  const client = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : null; // graceful no-op in dev without Redis
  module.exports = client;
  ```
- [ ] 5.2 Update `idempotencyMiddleware_v2.js` to use Redis when available, fall back to in-memory Map:
  ```js
  const redis = require('../config/redisClient');
  const TTL = 86400; // 24 hours
  async function getCache(key) { return redis ? redis.get(key) : memCache.get(key); }
  async function setCache(key, val) { redis ? redis.setex(key, TTL, val) : memCache.set(key, val); }
  ```
- [ ] 5.3 Add `REDIS_URL=` (blank) to `.env.example`
- [ ] 5.4 Add Jest test: same Idempotency-Key returns cached response (existing test should still pass)
- [ ] 5.5 Run full Jest suite

**Acceptance criteria:** If `REDIS_URL` is set, idempotency keys survive process restart. If not set, falls back to in-memory (dev-safe).

---

## Sprint 4 — Flutter Test Validation 🟠

### TASK-06 · Validate and fix Flutter integration tests
**Issue:** #20  
**Files:** `apps/mobile/integration_test/`  
**Status:** ⬜ Pending  
**Prerequisite:** Flutter SDK installed locally

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

## Sprint 5 — CI/CD Pipeline ⬜

### TASK-07 · Add GitHub Actions backend CI
**Files:** `.github/workflows/backend-test.yml` (new)  
**Status:** ⬜ Pending

**Steps:**
- [ ] 7.1 Create `.github/workflows/backend-test.yml`:
  - Triggers: push + PR on `main`
  - Services: `postgres:15` with `jyotish` database
  - Steps: checkout → `npm ci` → apply migrations → `npm test`
  - Environment secrets: `JWT_SECRET`, `RAZORPAY_KEY_SECRET` (test values only)
- [ ] 7.2 Add `test:ci` script to `backend/api/package.json`: `jest --forceExit --ci`
- [ ] 7.3 Push and verify green on GitHub

**Acceptance criteria:** PR checks show Jest passing on every push. Failures block merge.

---

### TASK-08 · Add GitHub Actions Playwright E2E CI
**Files:** `.github/workflows/e2e-test.yml` (new)  
**Status:** ⬜ Pending

**Steps:**
- [ ] 8.1 Create `.github/workflows/e2e-test.yml`:
  - Triggers: push + PR on `main`
  - Services: `postgres:15`
  - Steps: checkout → start backend (`node app.js &`) → `npx playwright install --with-deps chromium` → `npm test`
  - Use `wait-on` to wait for backend to be ready before tests
- [ ] 8.2 Run Playwright in `--reporter=github` format for inline PR annotations
- [ ] 8.3 Push and verify green

**Acceptance criteria:** All 30 Playwright tests pass in CI on every PR.

---

### TASK-09 · Add `.env.example` with all required variables
**Files:** `backend/api/.env.example` (new)  
**Status:** ⬜ Pending

**Steps:**
- [ ] 9.1 Create `backend/api/.env.example`:
  ```
  PORT=3000
  NODE_ENV=development
  DB_URI=postgres://postgres:password@localhost:5432/jyotish
  JWT_SECRET=<generate: openssl rand -hex 48>
  RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
  RAZORPAY_KEY_SECRET=<from Razorpay dashboard>
  RAZORPAY_WEBHOOK_SECRET=<from Razorpay dashboard>
  AGORA_APP_ID=<from Agora console>
  AGORA_APP_CERTIFICATE=<from Agora console>
  REDIS_URL=redis://localhost:6379
  ALLOWED_ORIGINS=
  ```
- [ ] 9.2 Confirm `.env` remains in `.gitignore`

**Acceptance criteria:** New developers can `cp .env.example .env` and know exactly what to fill in.

---

## Sprint 6 — Production Polish ⬜

### TASK-10 · Rate limiting hardening
**Files:** `backend/api/middleware/rateLimiter.js`  
**Status:** ⬜ Pending

**Steps:**
- [ ] 10.1 Read current rate limiter config
- [ ] 10.2 Add tighter limits for auth endpoints: max 10 requests / 15 min per IP on `/auth/register` and `/auth/login` (brute force protection)
- [ ] 10.3 Add test: 11th login attempt in window returns 429

---

### TASK-11 · Implement refresh token pattern (full JWT revocation)
**Issue:** #18 follow-up  
**Files:** `backend/api/routes/auth.js`, new migration  
**Status:** ⬜ Pending  
**Prerequisite:** TASK-05 (Redis)

**Steps:**
- [ ] 11.1 Add `refresh_tokens` table (id, user_id, token_hash, expires_at, revoked)
- [ ] 11.2 `POST /auth/login` — issue short-lived access token (15 min) + refresh token (30d, stored in DB)
- [ ] 11.3 `POST /auth/refresh` — validates refresh token, issues new access token
- [ ] 11.4 `POST /auth/logout` — marks refresh token as revoked
- [ ] 11.5 Update Flutter to store refresh token and call `/auth/refresh` on 401
- [ ] 11.6 Tests for all three endpoints

---

### TASK-12 · Metrics and health endpoint
**Files:** `backend/api/routes/metrics.js`  
**Status:** ⬜ Pending

**Steps:**
- [ ] 12.1 Read existing `metrics.js` to understand what's there
- [ ] 12.2 Add `GET /health` returning DB connection status + uptime
- [ ] 12.3 Ensure `/health` is unauthenticated (load balancer / k8s probe)

---

## Completed ✅

| Task | Description | Issue |
|------|-------------|-------|
| Auth #1 | Bearer token prefix stripped in authMiddleware | #1 |
| Auth #2 | Email/password auth replaces phone/OTP | #17 |
| Security #1 | `timingSafeEqual` for Razorpay HMAC | #4 |
| Security #2 | Rate stored server-side — billing bypass fixed | #5 |
| Security #3 | JWT expiry 30d → 7d | #18 |
| Flutter #1 | `astrologer_id` cast `int` → `String` | #7 |
| Flutter #2 | Full Agora RTC v6 implementation | #8 |
| Flutter #3 | `setState` mounted guard in `_endCall` | #19 |
| DB #1 | wallet_balance CHECK constraint | #11 |
| DB #2 | `transactions.reference` UNIQUE + idempotent credit | #12 |
| DB #3 | Performance indexes (calls, astrologers) | #13 |
| DB #4 | Partial UNIQUE index: one active call per user | #14 |
| DB #5 | Enum CHECK constraints on status/type columns | #15 |
| DB #6 | `rate_per_minute` column on calls | #5 |
| App #1 | Transaction status `'success'` (was stuck at `'pending'`) | #16 |
| App #2 | `app.js` — `listen()` guarded by `require.main === module` | – |
| App #3 | `models/call.js` — added `rate_per_minute` field | – |
| App #4 | `atomicDeduct` — unique reference per debit transaction | – |
| Tests #1 | 37 Jest unit/integration tests all passing | – |
| Tests #2 | 30 Playwright E2E tests all passing | #21 |
| Tests #3 | Razorpay mock in `phase1.test.js` | – |
| CI #1 | `e2e/.gitignore` excludes test artifacts | – |

---

## Issue Tracker Mapping

| GitHub Issue | Task | Status |
|---|---|---|
| #2 | TASK-02 | ⬜ Pending |
| #3 | TASK-03 | ⬜ Pending |
| #6 | TASK-01 | ⬜ Pending |
| #9 | TASK-04 | ⬜ Pending |
| #10 | TASK-05 | ⬜ Pending |
| #20 | TASK-06 | ⬜ Pending |
| – | TASK-07 | ⬜ Pending (CI) |
| – | TASK-08 | ⬜ Pending (CI) |
| – | TASK-09 | ⬜ Pending (.env.example) |
| – | TASK-10 | ⬜ Pending (rate limits) |
| – | TASK-11 | ⬜ Pending (refresh tokens) |
| – | TASK-12 | ⬜ Pending (health endpoint) |

---

## Priority Order for Next Session

```
TASK-01  →  TASK-02  →  TASK-03   (Critical security — do together, ~2h)
TASK-04                            (Logout — ~30 min)
TASK-05                            (Redis idempotency — ~45 min)
TASK-07  →  TASK-08  →  TASK-09   (CI pipeline — ~1h)
TASK-06                            (Flutter tests — needs Flutter SDK locally)
TASK-10  →  TASK-11  →  TASK-12   (Polish — pre-launch)
```
