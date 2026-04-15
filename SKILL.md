# SKILL: JyotishConnect (Vedic Caller)

> Generated via Skill_Seekers analysis pipeline — architecture_overview + api_documentation + security_focus + skill_polish stages

## Overview

JyotishConnect is a production-ready **Vedic astrology voice consulting platform** that connects seekers (users) with astrologers for real-time voice consultations. The platform handles per-minute billing, atomic wallet deductions, OTP-less phone login, and Razorpay payment integration.

**Tech Stack:**
- Mobile: Flutter (Dart)
- Backend: Node.js + Express
- Database: PostgreSQL (Supabase) + Sequelize ORM
- Voice: Agora RTC
- Payments: Razorpay

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Flutter Mobile App                        │
│  LoginScreen → HomeScreen → AstrologerList → CallScreen     │
│                          ↓                                   │
│              WalletWidget + HistoryScreen                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP + JWT
┌──────────────────────▼──────────────────────────────────────┐
│                  Node.js / Express API                       │
│  /auth  /astrologer  /call  /wallet  /payment  /webhook     │
│                                                             │
│  Middleware: JWT auth → Rate limiter → Idempotency          │
│  Services:  callLifecycle → walletEngine → billingEngine    │
└──────────────────────┬──────────────────────────────────────┘
                       │ Sequelize ORM
┌──────────────────────▼──────────────────────────────────────┐
│              PostgreSQL (Supabase)                           │
│   users · astrologers · calls · transactions                 │
│   RLS policies: users own their data; astrologers public     │
└─────────────────────────────────────────────────────────────┘
                       │ webhooks / SDK
┌──────────────────────▼──────────────────────────────────────┐
│   Razorpay (payments)   │   Agora RTC (voice)               │
└─────────────────────────────────────────────────────────────┘
```

**Architecture Style:** Layered monolith — presentation (Flutter) → API (Express) → service layer → data layer

---

## Key Concepts

1. **Atomic Wallet Deduction** — All balance changes use `SELECT ... FOR UPDATE` + DB transaction to prevent race conditions and negative balances.
2. **Call Lifecycle** — A call session tracks `startTime`, computes `duration` on end, then atomically deducts `(rate / 60) * duration` from the user's wallet.
3. **Idempotency** — In-memory key store prevents duplicate API operations (payment capture, wallet deduct) on retry.
4. **Per-minute Billing** — Rate is stored as `rate_per_minute` (INR). Cost is pro-rated per second: `cost = (rate / 60) * seconds`.
5. **RLS Security** — Supabase Row Level Security ensures users can only access their own calls, wallets, and transactions.

---

## Quick Start

### Run Backend
```bash
cd backend/api
npm install
node app.js           # Listens on PORT (default 3000)
```

### Run Flutter App
```bash
cd apps/mobile
flutter pub get
flutter run
```

### Key Environment Variables
```
PORT=3000
DATABASE_URL=postgres://...
JWT_SECRET=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | None | Phone login → JWT token |
| GET | `/astrologer` | None | List all astrologers |
| GET | `/availability` | JWT | Check astrologer availability |
| POST | `/call/start` | JWT | Start call → Agora channel + token |
| POST | `/call/end` | JWT | End call → deduct wallet |
| POST | `/wallet/deduct` | JWT | Manual wallet deduction |
| GET | `/callHistory` | JWT | User call history |
| POST | `/payment/success` | JWT | Record payment credit |
| POST | `/webhook/razorpay` | HMAC | Razorpay payment.captured event |
| GET | `/metrics` | None | Uptime + memory metrics |

---

## Data Model

```sql
users        (id uuid PK, phone unique, name, wallet_balance numeric)
astrologers  (id uuid PK, name, rate_per_minute numeric, is_available bool)
calls        (id uuid PK, user_id FK, astrologer_id FK,
              duration_seconds int, cost numeric, status,
              started_at, ended_at)
transactions (id uuid PK, user_id FK, amount numeric,
              type credit|debit, status, reference)
```

---

## Business Rules

- Balance must never go negative — enforced in `walletEngine.atomicDeduct`
- Payment signatures must be verified via HMAC-SHA256 before crediting
- All mutating API calls must support idempotency via `Idempotency-Key` header
- Call cost is always computed server-side — never trust client-submitted cost
- Rate limiting applied globally to prevent abuse

---

## Component Map

| File | Responsibility |
|------|----------------|
| `backend/api/app.js` | Express app bootstrap, middleware chain |
| `backend/api/services/callLifecycle.js` | Start/end call session management |
| `backend/api/services/walletEngine.js` | Atomic balance deduction with DB lock |
| `backend/api/services/billingEngine.js` | Per-second billing accumulator |
| `backend/api/services/razorpayService.js` | HMAC signature verification |
| `backend/api/routes/webhook_v2.js` | Razorpay webhook handler |
| `backend/api/middleware/idempotencyMiddleware_v2.js` | Request deduplication |
| `apps/mobile/lib/features/call/call_screen_v2.dart` | In-call timer + cost display |
| `apps/mobile/lib/features/auth/login_screen_v2.dart` | Phone-based login flow |
| `apps/mobile/lib/services/call_service.dart` | Flutter ↔ API call bridge |
| `supabase/migrations/...schema.sql` | Full DB schema + RLS policies |

---

## External Integrations

| Service | Usage | Config |
|---------|-------|--------|
| Razorpay | Payment orders + webhook capture | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Agora RTC | Voice channel token generation | `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` |
| Supabase | PostgreSQL + RLS + migrations | `DATABASE_URL` |

---

## Quality & Launch Checklist

- [ ] Backend deployed to production URL
- [ ] Mobile app pointed at prod API endpoint
- [ ] Razorpay live keys configured + webhook verified
- [ ] Agora production credentials set
- [ ] Real-device call flow tested
- [ ] Billing accuracy validated (>100 call sessions)
- [ ] Crash rate < 1%, call success rate > 95%

---

*Analyzed using [Skill_Seekers](https://github.com/yusufkaraaslan/Skill_Seekers) workflow pipeline.*
