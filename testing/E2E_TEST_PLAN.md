# JyotishConnect — End-to-End Test Plan

## Strategy Overview

Three test layers, each owning a distinct scope:

```
Unit (Jest)          — pure functions, billing formula, HMAC logic
API Integration      — Supertest full request chains against real DB
E2E / UI             — Flutter integration_test (mobile) + Playwright (API journeys)
```

Coverage targets (from skills/testing.md):
- `walletEngine` + `billingEngine`: 100%
- `callLifecycle`: 90%
- Routes (integration): 80%
- Flutter screens (integration): key happy path + one error path per screen

---

## Layer 1 — Unit Tests (Jest)

**Location**: `backend/api/tests/`
**Runner**: `npm test` in `backend/api/`

Already implemented. Key suites:
| File | What it covers |
|---|---|
| `auth.test.js` | Login, JWT shape, find-or-create |
| `wallet.test.js` | Billing formula variants, balance fetch, deduct |
| `call.test.js` | Start/end auth gates, history |
| `phase1.test.js` | Webhook HMAC, payment success gates |

**Gaps to fill** (see issues #20, #21):
- Billing formula edge cases: zero-second call, sub-penny cost, very long calls
- Concurrent deduction test (two simultaneous `atomicDeduct` calls)
- Duplicate payment_id on `atomicCredit` (idempotency at DB level)

---

## Layer 2 — API Integration Tests (Jest + Supertest)

**Location**: `backend/api/tests/e2e/`
**Runner**: `npm run test:e2e`

Full request-chain tests. Each test bootstraps a real DB transaction (rolled back after) or uses a dedicated test schema.

### Journey: Wallet Top-up
```
POST /auth/login         → JWT
POST /payment/create-order { amount: 500 }  → { order_id, amount_paise }
  (simulate Razorpay: compute valid HMAC)
POST /payment/success { order_id, payment_id, signature, amount: 500 }
GET  /wallet/balance     → assert balance == 500
  (repeat POST /payment/success with same payment_id)
  → assert 409 or identical response (idempotency)
```

### Journey: Full Call + Billing
```
POST /auth/login         → JWT
  (seed wallet to ₹200)
POST /call/start { astrologer_id, rate: 60 }
  → assert { call_id, agora_token, channel }
  (wait 3 seconds in test — or mock time)
POST /call/end { call_id, rate: 60, duration_seconds: 180 }
  → cost = (60/60)*180 = ₹180
GET  /wallet/balance     → assert balance == 200-180 = ₹20
GET  /callHistory        → assert latest call has duration=180, cost=180
```

### Journey: Insufficient Balance
```
POST /auth/login         → JWT (wallet = ₹0)
POST /call/start { astrologer_id, rate: 60 }
  → assert 400 "Insufficient balance"
```

### Journey: Concurrent Deductions (race condition)
```
Seed wallet to ₹100
Two simultaneous POST /call/end (same user, each wanting to deduct ₹60)
Assert: total deducted == ₹60 (not ₹120), wallet == ₹40
Assert: one request succeeds, one fails with 400
```

---

## Layer 3A — Playwright API Journey Tests

**Location**: `e2e/tests/`
**Runner**: `npm test` in `e2e/`
**Target**: `http://localhost:3000` (configurable via `BASE_URL` env var)

These are black-box HTTP tests against a running backend. They simulate what the mobile app does, verifying the complete API contract.

### Spec files
| File | Journey |
|---|---|
| `01_auth_wallet.spec.js` | Register → top-up → verify balance |
| `02_call_flow.spec.js` | Login → start call → end call → verify billing + history |
| `03_idempotency.spec.js` | Submit same payment twice → second is no-op |
| `04_concurrent_deductions.spec.js` | Race two deductions → DB constraint stops double-spend |
| `05_security.spec.js` | Auth gates, Bearer header, HMAC forgery rejected |

### Running
```bash
cd e2e
npm install
BASE_URL=http://localhost:3000 npm test
```

---

## Layer 3B — Flutter Integration Tests (UI E2E)

**Location**: `apps/mobile/integration_test/`
**Runner**: `flutter test integration_test/` on a connected device or emulator

These tests drive the real Flutter UI. Network calls are intercepted by `http_mock_adapter` (injected via a test `ApiClient`) so tests are deterministic without a running backend.

### Setup
```yaml
# pubspec.yaml dev_dependencies
integration_test:
  sdk: flutter
mockito: ^5.4.4
http_mock_adapter: ^0.6.1
```

### Test files
| File | Screens exercised |
|---|---|
| `test_01_auth_flow.dart` | LoginScreen → home navigation |
| `test_02_wallet_widget.dart` | WalletWidget balance display, refresh, amount chips |
| `test_03_astrologer_list.dart` | AstrologerListScreen loads, wallet embedded, call button |
| `test_04_call_flow.dart` | Start call UI, timer visible, end call, balance updates |
| `test_05_call_history.dart` | HistoryScreen shows call entries |

### Running
```bash
cd apps/mobile
flutter test integration_test/test_01_auth_flow.dart -d <device-id>
# Run all:
flutter test integration_test/ -d <device-id>
```

---

## Test Data Strategy

### Backend tests
- Each test suite creates its own user via `POST /auth/login` with a unique phone number (`+9199990000XX`)
- Wallet balance is seeded via direct `walletEngine.atomicCredit()` call in `beforeEach`
- Astrologers are assumed present from migration seed data

### Flutter tests
- All API calls mocked via `http_mock_adapter`
- Token stored in `FlutterSecureStorage` replaced with in-memory mock for tests
- No device credentials required

### Razorpay simulation
For tests that exercise the payment flow, signatures are generated locally:
```js
const crypto = require('crypto');
function testSignature(orderId, paymentId) {
  return crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}
```

---

## CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - run: cd backend/api && npm ci && npm test

  e2e-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd backend/api && npm ci && node app.js &
      - run: cd e2e && npm ci && npm test

  flutter-integration:
    runs-on: macos-latest        # iOS simulator needs macOS
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
      - run: cd apps/mobile && flutter pub get
      - run: cd apps/mobile && flutter test integration_test/
```

---

## Issue References

| Issue | Title | Priority |
|---|---|---|
| #20 | Flutter integration tests completely missing | High |
| #21 | No E2E test suite | High |
| #7 | Runtime crash: astrologer_id cast as int | Critical — must fix before E2E runs |
| #8 | Agora RTC unimplemented | High — mock in tests |
