# MASTER TEST PLAN — JyotishConnect

Last updated: 2026-04-21

---

## Test Pyramid

```
         ┌──────────────────────────────┐
         │   Layer 5: Visual & SDK      │  visual_ui.spec.js (local)
         │   Flutter web rendering,     │  11 tests
         │   icon fonts, Razorpay SDK   │
         ├──────────────────────────────┤
         │   Layer 4: Flutter UI E2E    │  flutter_ui.spec.js, login_flow.spec.js (local)
         │   Actual UI interaction,     │  28 tests
         │   semantics tree, screens    │
         ├──────────────────────────────┤
         │   Layer 3: API E2E           │  Playwright request fixture (CI)
         │   Full flows via HTTP,       │  ~60 tests across all spec files
         │   real Supabase DB           │
         ├──────────────────────────────┤
         │   Layer 2: Integration       │  Jest + Supertest (CI)
         │   API endpoints + real DB    │  ~50 tests
         ├──────────────────────────────┤
         │   Layer 1: Unit Tests        │  Jest (CI)
         │   Business logic in          │  ~30 tests
         │   isolation, no network      │
         └──────────────────────────────┘
```

---

## Personas

| # | Persona | Description |
|---|---------|-------------|
| 1 | New Seeker | First-time registration, zero balance |
| 2 | Returning Seeker | Has account, auto-login via refresh token |
| 3 | Funded Seeker | Balance ≥ ₹10, can start a call |
| 4 | Low Balance Seeker | Balance < ₹10, call blocked |
| 5 | New Astrologer | First-time registration, sets rate |
| 6 | Available Astrologer | Online, can receive calls |
| 7 | Admin | Can see platform metrics, trigger withdrawals |

---

## Test Cases by Layer

### Layer 1 — Unit (Jest, no DB)

| Test | Module | Status |
|------|--------|--------|
| `walletEngine.atomicDeduct` hits zero correctly | walletEngine.js | PASS |
| `walletEngine.atomicDeduct` throws on negative | walletEngine.js | PASS |
| Billing formula: `(rate/60)*duration` | billingEngine.js | PASS |
| Razorpay HMAC valid signature | webhook_v2.js | PASS |
| Razorpay HMAC invalid signature returns 400 | webhook_v2.js | PASS |
| Duplicate Idempotency-Key returns same response | idempotency middleware | PASS |

### Layer 2 — Integration (Jest + Supertest + Supabase)

| Test | Endpoint | Status |
|------|----------|--------|
| Register seeker returns JWT + user_id | POST /auth/register | PASS |
| Login with valid creds returns JWT | POST /auth/login | PASS |
| Login with wrong password returns 401 | POST /auth/login | PASS |
| Wallet balance starts at 0 | GET /wallet/balance | PASS |
| test-credit increases balance | POST /wallet/test-credit | PASS |
| Call start deducts hold | POST /call/start | PASS |
| Call end bills correctly | POST /call/end | PASS |
| Call start blocked with 0 balance | POST /call/start | PASS |
| Concurrent deductions — only one succeeds | POST /call/start × 2 | PASS |
| Admin seed is idempotent | POST /admin/seed | PASS |
| Platform fee split is correct | POST /call/end | PASS |

### Layer 3 — API E2E (Playwright request, CI)

| Flow | Tests | Status |
|------|-------|--------|
| Seeker registration + login | UI-08, UI-09 | PASS |
| Astrologer registration + JWT role | UI-11 | PASS |
| Astrologer list + search | UI-12, UI-13 | PASS |
| Wallet balance + top-up + history | UI-14, UI-15, UI-16 | PASS |
| Astrologer profile + 404 | UI-17, UI-18 | PASS |
| Call start + end (happy path) | UI-19 | PASS |
| Call blocked — insufficient balance | UI-20 | PASS |
| Rating after completed call | UI-21 | PASS |
| Call history after completed call | UI-22 | PASS |
| Astrologer availability toggle | UI-23 | PASS |
| Astrologer earnings after call | UI-24 | PASS |
| Incoming call visible to astrologer | UI-25 | PASS |
| Astrologer can decline call | UI-26 | PASS |
| Admin withdrawal flow | admin_withdrawal.spec.js | PASS |
| Security edge cases (auth bypass) | security_edge.spec.js | PASS |

### Layer 4 — Flutter UI (Playwright page, local only)

| Flow | Tests | Status |
|------|-------|--------|
| App title is JyotishConnect | UI-01 | LOCAL |
| Flutter view renders without JS errors | UI-02 | LOCAL |
| Responsive at 375/768/1280 | UI-03–05 | LOCAL |
| Login screen shows role buttons | UI-06, UI-07 | LOCAL |
| Role toggle (Seeker/Astrologer) | UI-10 | LOCAL |
| Flutter login screen screenshot | UI-27, UI-28 | LOCAL |
| Full login form interaction | login_flow.spec.js | LOCAL |

### Layer 5 — Visual & SDK (Playwright page, local only)

| Scenario | Test | What It Catches | Status |
|----------|------|-----------------|--------|
| No broken icon □ boxes | VIS-01 | `uses-material-design: true` missing in pubspec | LOCAL |
| No JS errors on load | VIS-02 | Flutter web bootstrap failures | LOCAL |
| `window.Razorpay` defined | VIS-03 | checkout.js not injected in index.html | LOCAL |
| Add Funds opens checkout modal | VIS-04 | Razorpay SDK silently failing on web | LOCAL |
| Login screen visual regression | VIS-05 | Layout breaks after code changes | LOCAL |
| Home screen visual regression | VIS-06 | Widget tree changes breaking layout | LOCAL |
| No overflow at 375px | VIS-07a | Content clipped on small screens | LOCAL |
| No overflow at 768px | VIS-07b | Tablet layout issues | LOCAL |
| No overflow at 1280px | VIS-07c | Desktop layout issues | LOCAL |
| Call Now disabled at ₹0 | VIS-08 | Button enabled when it shouldn't be | LOCAL |
| Wallet shows ₹0.00 | VIS-09 | Balance not rendering for new user | LOCAL |
| Astrologer profile badges | VIS-10 | Rate/availability badges missing | LOCAL |
| create-order returns order_id | VIS-11 | Backend required before Razorpay opens | LOCAL |

---

## Gaps — Manual Verification Required Before Each Release

| Scenario | Reason automation cannot cover it | Manual steps |
|----------|-----------------------------------|--------------|
| Complete Razorpay payment (sandbox) | Requires real card interaction in Razorpay UI | Use test card 4111111111111111, any future date |
| Agora voice call — audio works | Requires microphone + WebRTC + real peer | Two devices, start call, verify audio both ways |
| Flutter iOS rendering | Only web is automated | Run `flutter run` on iOS simulator, check all screens |
| Flutter Android rendering | Only web is automated | Run on Android emulator or physical device |
| Push notifications (future) | Requires device + FCM credentials | Manual test on physical device |
| Deep link handling | Requires OS-level routing | Manual test via `adb am start` or iOS Simulator URL |

---

## Test Authoring Checklist

When adding a new feature, ensure these tests exist:

### New Flutter screen
- [ ] VIS: No JS errors when navigating to screen
- [ ] VIS: No horizontal overflow at 375px
- [ ] VIS: Key widgets visible via `flt-semantics`
- [ ] VIS: Visual regression baseline screenshot taken
- [ ] API: Backend endpoint(s) covered by API E2E

### New payment / SDK integration
- [ ] VIS: `window.SdkName` is defined (SDK injected in index.html)
- [ ] VIS: Primary button opens expected modal / popup
- [ ] API: Backend order-creation endpoint tested
- [ ] Unit: HMAC / signature verification tested at 100%

### New API endpoint
- [ ] Unit: Core business logic tested in isolation
- [ ] Integration: Happy path + primary error case
- [ ] API E2E: Full flow via Playwright request fixture
- [ ] Security: Unauthenticated request returns 401
- [ ] Security: Wrong role returns 403

### New UI state (disabled, loading, error)
- [ ] VIS: Disabled state is not tappable in flt-semantics
- [ ] VIS: Error message text visible in semantics tree
- [ ] VIS: Loading indicator present during async operation

---

## Running All Tests

```bash
# CI (runs automatically on push to main)
cd backend/api
npm test                          # Jest: unit + integration (~94 tests)
npx playwright test               # API E2E + any non-ignored specs

# Local full suite (requires Flutter web + backend running)
node app.js &
# In apps/mobile: flutter run -d chrome --web-port 8282 &

npx playwright test --reporter=list   # All specs including visual + UI

# Update visual regression baselines after intentional UI changes
npx playwright test tests/e2e/visual_ui.spec.js --update-snapshots
```

---

## Status Summary

| Layer | # Tests | Runs in CI | Last Run |
|-------|---------|-----------|----------|
| Unit (Jest) | ~30 | Yes | 2026-04-21 ✅ |
| Integration (Jest) | ~64 | Yes | 2026-04-21 ✅ |
| API E2E (Playwright) | ~60 | Yes | 2026-04-21 ✅ |
| Flutter UI (Playwright) | 28 | No (local) | 2026-04-21 ✅ |
| Visual & SDK (Playwright) | 11 | No (local) | 2026-04-21 — needs baseline |
