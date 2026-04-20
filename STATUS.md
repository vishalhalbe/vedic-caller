# JyotishConnect — Multi-Role Project Status Review

> **Date:** 2026-04-20 (updated session 14)
> **Branch:** claude/analyze-skill-seekers-gGKzr  
> **E2E Suite:** 101/101 passing  
> **Overall MVP:** ~95%  
> **Deployment:** 🟢 Live at https://vedic-caller.onrender.com

---

## 🔒 Security Engineer

### Resolved (All CRITICALs Cleared)

| ID | Finding | Fix |
|----|---------|-----|
| SEC-CRIT-01 | Bearer token prefix not stripped in authMiddleware | `token.replace(/^Bearer\s+/i, '')` |
| SEC-CRIT-02 | Client-supplied rate at `/call/end` — billing bypass | Rate stored server-side in `calls.rate_per_minute` |
| SEC-CRIT-03 | HMAC comparison with `===` — timing attack | `crypto.timingSafeEqual` on webhook + cleanup |
| SEC-CRIT-04 | `GET /astrologer/all` — unauthenticated | Route deleted entirely |
| SEC-CRIT-05 | `/availability/toggle` no ownership check | `requireAdmin` middleware added |
| SEC-CRIT-06 | `/payment/success` credits client-supplied amount | Server-stored order amount (orders table) |
| SEC-CRIT-07 | Webhook `atomicCredit` before order status claimed | Atomic `UPDATE WHERE status=created` |
| SEC-CRIT-08 | `authLimiter` on `/auth/logout` — NAT IP exhaustion DoS | Logout excluded from authLimiter |
| SEC-CRIT-09 | `settings.json` hardcoded Razorpay credentials | Env vars only; `bypassPermissions` removed |

### Verified by E2E (security_edge.spec.js)

| Test | Result |
|------|--------|
| User A cannot read User B wallet/history | ✅ Pass |
| Seeker B cannot end/rate Seeker A's call | ✅ Pass |
| Astrologer JWT blocked from seeker wallet | ✅ Pass (404) |
| SQL injection in name search + ID param | ✅ Pass (no crash, no data leak) |
| Double end-call idempotent — no double deduction | ✅ Pass |
| Duplicate rating returns 409 | ✅ Pass |

### Open

| ID | Finding | Priority |
|----|---------|----------|
| S10-SEC-04 | Verify test-mode HMAC guard doesn't silently pass in staging | 🟡 Medium |
| — | No `photo_url` upload endpoint — S3 presigned URL not yet implemented | 🟡 Low |
| — | Idempotency store is in-memory Map — won't survive restart | 🟡 Low (backed by DB for payments) |

---

## 🖥️ Backend Engineer

### API Surface (13 route files, 30+ endpoints)

| Module | Endpoints | Status |
|--------|-----------|--------|
| Seeker Auth | register, login, refresh, logout | ✅ Complete |
| Astrologer Auth | register, login | ✅ Complete |
| Astrologer Public | list (with ratings), profile | ✅ Complete |
| Astrologer Private | me, availability, earnings, withdrawal | ✅ Complete |
| Call | start, end, decline, incoming, cleanup | ✅ Complete |
| Call History | paginated list | ✅ Complete |
| Wallet | balance, transactions, test-credit | ✅ Complete |
| Payments | create-order, success | ✅ Complete |
| Webhook | Razorpay payment.captured (atomic) | ✅ Complete |
| Admin | stats, astrologers, availability toggle, seed | ✅ Complete |
| Metrics/Health | /health (public), /metrics (admin) | ✅ Complete |

### Service Layer

| Service | Status | Notes |
|---------|--------|-------|
| `walletEngine.atomicDeduct` | ✅ | `SELECT FOR UPDATE` + DB transaction; wallet_balance CHECK constraint |
| `walletEngine.atomicCredit` | ✅ | Idempotent via unique reference; 409 on duplicate |
| `callLifecycle.startCall` | ✅ | Marks astrologer unavailable atomically |
| `callLifecycle.finaliseCall` | ✅ | Uses `end_call` RPC — single atomic transaction for deduct+update+credit |
| `walletService.calculateDeduction` | ✅ | Single billing formula used everywhere |

### Observability

- **Structured logging:** `pino` + `pino-http` — JSON in production, pretty-print in dev
- **Health endpoint:** `GET /health` — DB connectivity check, uptime, unauthenticated
- **Error handling:** `unhandledRejection` → pino.fatal + process.exit(1)
- **Startup validation:** Fails fast if `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET` missing

### Open

| Item | Priority |
|------|----------|
| Pagination on `GET /astrologer` (deferred until >100 astrologers) | ⬜ P3 |
| `photo_url` upload endpoint (S3 presigned) | ⬜ P2 |
| Admin approval UI for withdrawal requests | ⬜ P2 |
| Full JWT revocation (currently: refresh token rotation only) | ⬜ P3 |

---

## 📱 Flutter Engineer

### Screens (12 files)

| Screen | Route | Status |
|--------|-------|--------|
| `login_screen_v2.dart` | `/login` | ✅ Seeker + Astrologer role toggle, register flow |
| `astrologer_list_screen.dart` | `/home` | ✅ Search with debounce, wallet balance, star ratings on cards |
| `astrologer_profile_screen.dart` | `/astrologer/:id` | ✅ SliverAppBar, bio, chips, reviews, Call CTA |
| `call_screen_v2.dart` | `/call` | ✅ Agora RTC, live timer, cost display, 55-min auto-end, rating dialog |
| `incoming_call_screen.dart` | (push from dashboard) | ✅ 30s countdown, pulsing avatar, Accept/Decline |
| `history_screen.dart` | `/history` | ✅ Paginated, date labels |
| `wallet_widget.dart` | (embedded) | ✅ Balance, top-up button, Razorpay, custom amount |
| `wallet_topup_screen.dart` | `/wallet` | ✅ Balance card, WalletWidget, transaction list |
| `astrologer_dashboard_screen.dart` | `/astrologer-home` | ✅ Availability toggle, earnings, 5-sec polling |
| `earnings_screen.dart` | `/earnings` | ✅ Balance, withdrawal form, recent calls |
| `admin_screen.dart` | `/admin` | ✅ Availability toggle (admin only) |
| `wallet_provider.dart` | (provider) | ✅ WalletNotifier with refresh |

### State Management

- **Riverpod** `FutureProvider` + `StateNotifier` throughout
- `walletProvider` — global balance state, auto-refreshes after top-up
- `astrologersProvider` — `FutureProvider.family` keyed by search query
- `_profileProvider` — `FutureProvider.family` keyed by astrologer ID

### Navigation (GoRouter)

| Route | Screen |
|-------|--------|
| `/login` | LoginScreenV2 |
| `/home` | AstrologerListScreen (seeker) |
| `/astrologer/:id` | AstrologerProfileScreen |
| `/call` | CallScreenV2 (extra: astrologer_id, name, rate) |
| `/history` | HistoryScreen |
| `/wallet` | WalletTopUpScreen |
| `/astrologer-home` | AstrologerDashboardScreen |
| `/earnings` | EarningsScreen |
| `/admin` | AdminScreen |

### Open

| Item | Priority |
|------|----------|
| Flutter unit tests (`test/wallet_provider_test.dart`, `test/auth_service_test.dart`) | 🟠 High |
| Integration tests validated on device/emulator | 🟠 High |
| `MainShell` admin state not reactive to auth changes (S10-FL-03) | 🟡 Medium |
| FCM push notifications (F-06) — requires Firebase project | ⬜ Not started |
| Photo upload / avatar picker | ⬜ Deferred |
| Astrologer KYC / onboarding flow (F-11) | ⬜ Not started |

---

## 🗄️ Database Architect (DBA)

### Schema (16 migrations applied)

| Table | Purpose | Key Constraints |
|-------|---------|----------------|
| `users` | Seekers | `wallet_balance CHECK >= 0`, `is_admin bool` |
| `astrologers` | Providers | `email UNIQUE`, `password_hash`, `earnings_balance`, `specialty/bio/photo_url` |
| `calls` | Call ledger | `status CHECK`, UNIQUE partial index (one active per user), `rating CHECK 1-5`, `rated_at` |
| `transactions` | Wallet ledger | `reference UNIQUE`, `type CHECK (credit/debit)`, `status CHECK (success/pending/failed)` |
| `orders` | Payment orders | `status CHECK (created/captured/failed)`, amount immutable after creation |
| `withdrawal_requests` | Payout requests | `status CHECK`, FK to astrologers |
| `refresh_tokens` | Auth tokens | `token_hash UNIQUE`, `revoked bool`, `expires_at` + idx |

### Views

| View | Purpose |
|------|---------|
| `astrologer_avg_ratings` | `AVG(rating)` + `COUNT(*)` per astrologer — used by list + profile endpoints |

### RPCs

| RPC | Purpose |
|-----|---------|
| `end_call(call_id, user_id, rate_per_minute)` | Atomic: deduct seeker wallet + update call status + credit astrologer earnings |

### Indexes

| Index | Table | Purpose |
|-------|-------|---------|
| `idx_calls_user_active` | calls | Partial: one active call per user |
| `idx_calls_astrologer` | calls | Astrologer incoming call lookup |
| `idx_rt_expires_at` | refresh_tokens | Cleanup query performance |
| `idx_calls_rated` | calls | Unique partial: one rating per call |

### Open

| Item | Priority |
|------|----------|
| RLS policies — currently rely on app-level auth; Supabase RLS not fully enforced for all tables | 🟡 Medium |
| `withdrawal_requests` admin approval workflow (status: pending → approved → paid) | ⬜ P2 |
| `photo_url` storage migration (Supabase Storage bucket) | ⬜ P2 |

---

## 🧪 QA / Test Engineer

### Test Suite Summary (101 tests, 100% pass rate)

| Spec | Tests | Type | Coverage |
|------|-------|------|---------|
| `flutter_ui.spec.js` | 28 | Flutter UI + API | All 15 user stories — login, wallet, calls, ratings, history, dashboard, profile |
| `security_edge.spec.js` | 22 | Security + Edge | Data isolation, SQL injection, idempotency, empty/error states, withdrawal, pagination |
| `astrologer_auth.spec.js` | 8 | API | Register, login, token, role |
| `astrologer_dashboard.spec.js` | 10 | API | Availability, earnings, withdrawal requests |
| `call_flow.spec.js` | 9 | API | Full call lifecycle, decline, incoming |
| `ratings.spec.js` | 7 | API | Rate, duplicate, invalid values, 404, auth |
| `astrologer_profile.spec.js` | 6 | API | Profile, avg_rating, 404, transactions |
| `call_history.spec.js` | 3 | API | Empty, completed, auth |
| `login_flow.spec.js` | 3 | API + Flutter | Register→login→wallet→astrologers, refresh |
| `wallet.spec.js` | 6 | API | Balance, top-up, invalid amounts, accumulation |

### Screenshot Coverage

All 101 tests produce screenshots in `backend/api/test-results/`:
- **API tests:** JSON response rendered as styled HTML → screenshot via `recordResult()` (fixtures.js)
- **Flutter UI tests:** `page.screenshot()` at key moments → `ui-*.png` (12 screenshots)
- **Playwright auto:** `screenshot: 'on'` captures every test end → `<slug>-chromium/test-finished-1.png`

### CI Pipeline

| Workflow | Trigger | Status |
|----------|---------|--------|
| `backend-test.yml` | push/PR → `backend/api/**`, `supabase/migrations/**` | ✅ Node 20 + Postgres 15 + Jest |
| `e2e-test.yml` | push/PR → same paths | ✅ Playwright chromium + screenshots uploaded |

### Open

| Item | Priority |
|------|----------|
| Flutter `integration_test/` — not validated on device | 🟠 High |
| Flutter unit tests (`test/`) — 0 files exist | 🟠 High |
| Full login form-fill UI test (Flutter semantics + keyboard type) | 🟡 Medium |
| Golden file tests for key Flutter screens | 🟡 Medium |
| Load testing / stress test for concurrent calls | ⬜ P3 |

---

## ⚙️ DevOps / Infrastructure

### Docker Setup

| File | Status |
|------|--------|
| `backend/api/Dockerfile.local` | ✅ `node:20-alpine`, `npm ci --omit=dev`, HEALTHCHECK (renamed from Dockerfile so Render uses Node runtime) |
| `docker-compose.yml` | ✅ 4 services: db (postgres:16), api, cleanup (cron), nginx (prod profile); SUPABASE_URL/KEY added |
| Log rotation | ✅ json-file driver with max-size limits on all services |
| Migration auto-apply | ✅ Compose db service mounts `supabase/migrations/` (first run) |

### CI/CD

| Item | Status |
|------|--------|
| Jest unit tests in CI | ✅ `backend-test.yml` |
| Playwright E2E in CI | ✅ `e2e-test.yml` with screenshot upload |
| Migrations applied in CI | ✅ All 16 migration files applied via psql loop |
| Deploy to Render on push | ✅ `deploy.yml` — triggers Render deploy hook on push to main |

### Deployment — Render (Live)

| Item | Status |
|------|--------|
| Platform | ✅ Render free tier — https://vedic-caller.onrender.com |
| Config | ✅ `render.yaml` — Node runtime, Singapore region, `/health` healthcheck |
| Environment vars | ✅ All set in Render dashboard |
| Razorpay webhook | ✅ Created — ID `SfdSUWkjU1prax`, event `payment.captured`, URL set to Render |
| Agora credentials | ✅ App ID `8593844bb...` + Certificate `234d5fdb...` configured |
| Cleanup cron | ⬜ Needs setup on cron-job.org (POST /call/cleanup every 5 min) |

### Environment Variables

| Var | Required | Status |
|-----|----------|--------|
| `SUPABASE_URL` | ✅ | Set in Render + validated at startup |
| `SUPABASE_KEY` | ✅ | Set in Render + validated at startup |
| `JWT_SECRET` | ✅ | Set in Render + validated at startup |
| `RAZORPAY_KEY_ID` | ✅ prod | Set in Render |
| `RAZORPAY_KEY_SECRET` | ✅ prod | Set in Render |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ prod | Set in Render — matches webhook `SfdSUWkjU1prax` |
| `AGORA_APP_ID` | ✅ prod | `8593844bb7454075b6f493b2d81ac34b` |
| `AGORA_APP_CERTIFICATE` | ✅ prod | `234d5fdb7bb54fdebb82f4162a0ac652` |
| `ADMIN_SEED_SECRET` | optional | Set in Render |
| `CLEANUP_SECRET` | optional | Set in Render |

### Open

| Item | Priority |
|------|----------|
| Cleanup cron on cron-job.org (POST /call/cleanup every 5 min) | 🟠 High |
| Bootstrap first admin via POST /admin/seed | 🟠 High |
| Verify /health returns ok on live Render URL | 🟠 High |
| `SUPABASE_URL` / `SUPABASE_KEY` placeholders in CI (point to local Postgres) | 🟡 Medium — works for tests; real Supabase needed for staging |
| S3 / Supabase Storage for `photo_url` uploads | ⬜ P2 |
| Secrets rotation strategy | ⬜ P3 |

---

## 📊 Product Manager

### Feature Status vs. PRD

| Feature | PRD Priority | Status | Gap |
|---------|-------------|--------|-----|
| Seeker can find and call an astrologer | P0 | ✅ Done | — |
| Per-minute billing with wallet | P0 | ✅ Done | — |
| Astrologer can accept / decline calls | P0 | ✅ Done | — |
| Astrologer can go online / offline | P0 | ✅ Done | — |
| Seeker can top up wallet (Razorpay) | P0 | ✅ Done | — |
| Post-call rating by seeker | P1 | ✅ Done | — |
| Astrologer profile with reviews | P1 | ✅ Done | — |
| Seeker call history | P1 | ✅ Done | — |
| Astrologer earnings & withdrawal request | P1 | ✅ Done | Admin approval pending |
| Real-time incoming call (Supabase Realtime) | P1 | ⬜ Planned Sprint 11 | Replace 5-sec polling with WebSocket |
| Astrologer KYC / onboarding | P2 | ⬜ Not started | — |
| Photo upload | P2 | ⬜ Deferred | Needs S3/Supabase Storage |
| Refund / dispute handling | P2 | ⬜ Not started | — |
| Pagination on astrologer list | P3 | ⬜ Deferred | Until >100 astrologers |

### User Journeys — End-to-End Verified

| Journey | Verified By |
|---------|------------|
| Seeker registers → tops up wallet → calls astrologer → rates call | UI-19 + UI-21 |
| Seeker views astrologer profile before calling | UI-17 |
| Seeker views wallet transaction history | UI-16 |
| Seeker views call history | UI-22 |
| Astrologer registers → goes online → receives incoming call → accepts | UI-25 |
| Astrologer declines call | UI-26 |
| Astrologer checks earnings after call | UI-24 |
| Astrologer requests withdrawal | EDGE-09 |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Agora token expires mid-call (1hr) | Low | High | 55-min auto-end on client |
| Wallet deduction race (two simultaneous ends) | Very Low | Critical | `SELECT FOR UPDATE` + DB transaction |
| Supabase Realtime not implemented — astrologer misses call when backgrounded | Medium | High | 5-sec polling fallback works when app is foreground |
| Render free tier spin-down (15 min idle) | Medium | Medium | Upgrade to Starter $7/mo for always-on |
| Cleanup cron not yet set up on cron-job.org | High | Medium | Stale calls not cleaned up until configured |

---

## Summary — What's Done, What's Left

### Done ✅
- Full dual-role auth (seeker + astrologer) with JWT + refresh tokens
- Live voice calls with Agora RTC + per-minute billing
- Ratings, reviews, astrologer profiles
- Wallet top-up (Razorpay), transaction history, withdrawal requests
- 101 E2E tests (API, security, Flutter UI) — all passing with screenshots
- Production-grade logging (pino), env validation, CI/CD pipelines
- Docker setup with 4-service compose
- **Deployed to Render** — https://vedic-caller.onrender.com
- **Razorpay webhook** live — ID `SfdSUWkjU1prax`, `payment.captured` enabled
- **Agora credentials** configured — App ID + Certificate set

### Remaining for Launch 🚀
1. **Cleanup cron** — set up on cron-job.org (POST /call/cleanup every 5 min with x-cleanup-secret header)
2. **Bootstrap admin** — run POST /admin/seed once to create first admin user
3. **Supabase Realtime** (Sprint 11) — replace 5-sec polling with WebSocket subscription on `calls` table
4. **Flutter unit tests** (Sprint 9) — `test/wallet_provider_test.dart`, `test/auth_service_test.dart`
5. **Withdrawal admin approval** (Sprint 10) — admin screen to approve/reject withdrawal requests
6. **Upgrade Render** — free tier spins down after 15 min idle; upgrade to Starter ($7/mo) for production
