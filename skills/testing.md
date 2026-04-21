# Skill: Testing Strategy (JyotishConnect)

## Goal
Ensure system reliability across billing, payments, auth, call flows, and Flutter web UI through a layered test strategy — unit, integration, API E2E, and visual UI E2E.

## Test Architecture

```
backend/api/tests/
├── auth.test.js              # JWT login, token validation
├── call.test.js              # Call start/end, billing accuracy
├── wallet.test.js            # Deduction, negative balance guard
├── payment.test.js           # Razorpay order creation, webhook HMAC
├── admin.test.js             # Admin seed, platform fee
├── platform_fee.test.js      # Fee split logic
├── integration.test.js       # Cross-route integration
├── phase1.test.js            # Phase 1 regression suite
└── e2e/
    ├── flutter_ui.spec.js    # Flutter web UI + API-backed flows (28 tests)
    ├── visual_ui.spec.js     # Visual regression, icon rendering, Razorpay SDK (11 tests)
    ├── wallet.spec.js        # Wallet API flows
    ├── call_flow.spec.js     # Call lifecycle E2E
    ├── astrologer_auth.spec.js
    ├── astrologer_dashboard.spec.js
    ├── astrologer_profile.spec.js
    ├── call_history.spec.js
    ├── ratings.spec.js
    ├── security_edge.spec.js
    ├── admin_withdrawal.spec.js
    ├── ui_states.spec.js
    └── login_flow.spec.js    # Full Flutter login UI interaction

testing/
├── MASTER_TEST_PLAN.md       # Test strategy + coverage targets
└── E2E_TEST_REPORT.md        # Latest E2E run report
```

## Test Layers

### Layer 1 — Unit Tests (Jest)
Test business logic in isolation — no network, no DB:
- `walletEngine.atomicDeduct` — balance deduction and row-lock semantics
- `billingEngine.runBilling(rate, duration)` — accumulated cost per second
- `razorpayService.verifySignature(...)` — HMAC validation
- `callLifecycle` state transitions

### Layer 2 — Integration Tests (Jest + Supertest + real Supabase)
Test API endpoints with a real DB (CI uses live Supabase test project):
- `POST /auth/login` — valid/invalid credentials
- `POST /call/start` → `POST /call/end` — full lifecycle with billing
- `POST /wallet/deduct` — deduction, insufficient balance guard
- `POST /payment/create-order` → `POST /webhook/razorpay` — HMAC verify
- Idempotency: duplicate requests return cached response, no double-charge

### Layer 3 — API E2E Tests (Playwright `request` fixture)
Test all backend flows via HTTP without the Flutter UI. Run in CI:
- Full seeker + astrologer registration/login flows
- Wallet balance, top-up, transaction history
- Call start/end/rate/history
- Astrologer availability toggle, earnings
- Admin withdrawal, platform fee
- Security edge cases (auth bypass, invalid tokens)

### Layer 4 — Flutter UI Tests (Playwright `page` fixture — local only)
Test actual Flutter web rendering and user interactions. **Skipped in CI** (Flutter web not built there):
- `flutter_ui.spec.js` — 28 tests covering login screen, role toggle, API-backed registration
- `login_flow.spec.js` — full Flutter form interaction: type email/password, submit, redirects

### Layer 5 — Visual & SDK Tests (Playwright `page` fixture — local only)
**NEW** — catch rendering failures invisible to API tests:
- `visual_ui.spec.js` — 19 tests:
  - VIS-01: No broken icon □ boxes — Material Icons font loaded
  - VIS-02: No fatal JS errors on load
  - VIS-03: `window.Razorpay` defined — checkout.js injected in index.html
  - VIS-04: Add Funds button opens Razorpay checkout modal (popup or iframe)
  - VIS-05/06: Visual regression snapshots — login and home screens
  - VIS-07: No horizontal overflow at 375/768/1280px viewports
  - VIS-08: Call Now disabled when balance = 0
  - VIS-09: Wallet shows ₹0.00 for new user
  - VIS-10: Astrologer profile shows rate badge + availability badge
  - VIS-11: `/wallet/create-order` returns order_id before Razorpay opens
  - VIS-12/13: axe-core WCAG 2.0/2.1 audit + semantics tree accessible
  - VIS-14: No overflow at 414px (iPhone Plus) and 1024px (iPad)
  - VIS-15–18: Async states — loading spinner, empty states, form inputs present

## Critical Test Cases

| Test | What It Guards |
|------|----------------|
| `wallet.deduct` with exact balance | Balance hits zero, not negative |
| `wallet.deduct` below balance | Throws `Insufficient balance` |
| Duplicate `Idempotency-Key` | Returns same response, no DB side-effect |
| `call.end` cost matches formula | `(rate/60)*duration` — no rounding error |
| Razorpay HMAC valid | Transaction credited |
| Razorpay HMAC invalid | 400 returned, no credit |
| Concurrent deductions | Only one succeeds (row lock) |
| **Material Icons loaded** | **No □ boxes in Flutter web UI** |
| **`window.Razorpay` defined** | **Add Funds not silently broken** |
| **Razorpay checkout opens** | **Payment flow reachable by user** |
| **Call Now disabled at ₹0** | **User cannot start call without funds** |
| **No JS errors on load** | **App boots cleanly on web** |

## What Tests Cannot Catch — Manual Verification Required

| Scenario | Why automation misses it | Manual check |
|----------|--------------------------|-------------|
| Razorpay payment completion | Requires real card in sandbox | Use Razorpay test card once per release |
| Agora voice call audio | Requires microphone + real WebRTC | Manual call test on device |
| Push notifications | Requires device + FCM setup | Manual test on physical device |
| Flutter iOS/Android rendering | Only web is automated | Test on simulator before release |

## Running Tests

```bash
# Layer 1 + 2 + 3 (CI-safe, no Flutter needed)
cd backend/api
npm test                              # Jest unit + integration
npx playwright test --reporter=list   # API E2E (skips flutter_ui + login_flow)

# Layer 4 + 5 (local only — requires Flutter web running)
flutter run -d chrome --web-port 8282 &   # Terminal 1
node app.js &                             # Terminal 2 (if not running)
npx playwright test tests/e2e/flutter_ui.spec.js tests/e2e/visual_ui.spec.js tests/e2e/login_flow.spec.js --reporter=list

# Visual regression — update baseline snapshots after intentional UI changes
npx playwright test tests/e2e/visual_ui.spec.js --update-snapshots
```

## Coverage Targets

| Module | Target |
|--------|--------|
| `walletEngine.js` | 100% |
| `billingEngine.js` | 100% |
| `callLifecycle.js` | 90% |
| `routes/webhook_v2.js` | 100% |
| `routes/` (integration) | 80% |
| API E2E happy path | Pass in CI |
| Flutter UI visual smoke | Pass locally before each release |

## Test Authoring Rules

1. **Write test before logic** (TDD) for all billing and payment code
2. **100% coverage on `walletEngine`** — money is involved
3. **Never skip tests for webhook handlers** — signature bypass is a security risk
4. **Every new Flutter screen needs a VIS test** — at minimum: no JS errors, key widget visible, no overflow
5. **Every new payment SDK integration needs a SDK-loaded test** — check `window.SdkName` is defined
6. **Visual regression baseline must be updated when UI changes intentionally** — run `--update-snapshots`
7. **Every new screen needs an axe-core audit test** — use VIS-12 pattern, suppress canvas-specific rules
8. **Cross-browser (Firefox + WebKit) runs locally** — guarded by `CI` env in playwright.config.js; run before each release
9. **Form validation edge cases must be tested at API level** — empty fields, short passwords, malformed email, SQL injection, XSS payload
10. **API E2E tests must cover both happy path and the primary error case** — e.g. insufficient balance
