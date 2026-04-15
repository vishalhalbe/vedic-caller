# Skill: Testing Strategy (JyotishConnect)

## Goal
Ensure system reliability across billing, payments, auth, and call flows through a layered test strategy — unit, integration, and E2E.

## Test Architecture

```
backend/api/tests/
├── auth.test.js        # JWT login, token validation
├── call.test.js        # Call start/end, billing accuracy
├── wallet.test.js      # Deduction, negative balance guard
└── phase1.test.js      # Phase 1 integration suite

e2e/
└── tests/
    └── basic.spec.js   # Playwright full-flow tests

testing/
├── MASTER_TEST_PLAN.md # Test strategy + coverage targets
└── E2E_TEST_REPORT.md  # Latest E2E run report
```

## Test Layers

### Unit Tests (Jest)
Test business logic in isolation:
- `billingEngine.runBilling(rate, duration)` — accumulated cost per second
- `walletService.calculateDeduction(rate, seconds)` — formula: `(rate / 60) * seconds`
- `razorpayService.verifySignature(...)` — HMAC validation

### Integration Tests (Supertest)
Test API endpoints with a real DB:
- `POST /auth/login` — valid/invalid phone
- `POST /call/start` → `POST /call/end` — full lifecycle
- `POST /wallet/deduct` — deduction + insufficient balance
- `POST /payment/success` — credit recording
- Idempotency: duplicate requests return cached response

### E2E Tests (Playwright)
Test full user flows:
- User logs in → browses astrologers → starts call → ends call → sees updated wallet
- Payment top-up → balance increase
- Retry with `Idempotency-Key` → no duplicate transaction

## Critical Test Cases

| Test | What It Guards |
|------|----------------|
| `wallet.deduct` with exact balance | Balance hits zero, not negative |
| `wallet.deduct` below balance | Throws `'Insufficient balance'` |
| Duplicate `Idempotency-Key` | Returns same response, no DB side-effect |
| `call.end` cost matches formula | `(rate/60)*duration` — no rounding error |
| Razorpay signature valid | Transaction credited |
| Razorpay signature invalid | 400 returned, no credit |
| Concurrent deductions | Only one succeeds (row lock) |

## Quick Start

```bash
cd backend/api
npm install
npm test              # Run all Jest tests

cd e2e
npm install
npx playwright test   # Run Playwright E2E
```

## Rules

- **Write test before logic** (TDD) for all billing and payment code
- **100% coverage on `walletEngine` and `billingEngine`** — money is involved
- **E2E tests must cover the full happy path** and the low-balance blocked call edge case
- **Test idempotency with real duplicate requests** — not just unit mocks
- **Never skip tests for webhook handlers** — signature bypass is a security risk

## Coverage Targets

| Module | Target |
|--------|--------|
| `walletEngine.js` | 100% |
| `billingEngine.js` | 100% |
| `callLifecycle.js` | 90% |
| `razorpayService.js` | 100% |
| `routes/` (integration) | 80% |
| E2E happy path | Pass |

## Outputs
- > 80% overall coverage
- Zero billing logic regressions
- Full E2E flow validated on real device before launch
