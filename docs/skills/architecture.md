# Skill: System Architecture (JyotishConnect)

## Goal
Understand the full system topology of JyotishConnect — how the Flutter app, Node.js backend, Supabase database, Agora voice, and Razorpay payments interconnect.

## Architecture Style
**Layered monolith** with external service integrations.

```
┌───────────────────────────────────────────────────────┐
│              Flutter Mobile App (Dart)                 │
│                                                       │
│  Screens:  Login → Home → AstrologerList              │
│            → CallScreen → WalletWidget                │
│            → HistoryScreen                            │
│                                                       │
│  Services: auth_service · call_service                │
│            wallet_service · history_service           │
│                                                       │
│  Core:     api_client · token_storage · app_provider  │
└────────────────────┬──────────────────────────────────┘
                     │ HTTPS + JWT Bearer
                     │ Idempotency-Key header
┌────────────────────▼──────────────────────────────────┐
│           Node.js / Express (REST API)                 │
│                                                       │
│  Routes:  /auth  /astrologer  /availability           │
│           /call  /wallet  /callHistory                │
│           /payment  /webhook  /metrics                │
│                                                       │
│  Middleware stack (in order):                         │
│    logger → rateLimiter → json → idempotency          │
│    → authMiddleware (per route) → errorHandler        │
│                                                       │
│  Services:                                            │
│    callLifecycle · walletEngine · billingEngine       │
│    razorpayService · jwt · idempotency_simple         │
└──────┬─────────────────────────────────────┬──────────┘
       │ Sequelize ORM                        │ HTTPS webhooks
┌──────▼──────────────┐           ┌──────────▼──────────┐
│ PostgreSQL/Supabase  │           │      Razorpay        │
│                     │           │  payment.captured    │
│  users              │           │  webhook → /webhook  │
│  astrologers        │           │  /razorpay           │
│  calls              │           └─────────────────────┘
│  transactions       │
│                     │  ┌──────────────────────────────┐
│  RLS policies       │  │         Agora RTC             │
└─────────────────────┘  │  channel token generation    │
                         │  voice streaming              │
                         └──────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Flutter app** | User interface, local timer, token storage, API calls |
| **Express API** | Business logic, auth, rate limiting, idempotency |
| **callLifecycle service** | Session state (startTime, userId, rate) |
| **walletEngine service** | Atomic DB deduction with pessimistic locking |
| **billingEngine service** | Billing accumulation (per-second calculation) |
| **razorpayService** | Payment signature verification |
| **Supabase/PostgreSQL** | Persistent storage, RLS-enforced data isolation |
| **Agora RTC** | Real-time voice streaming between user and astrologer |
| **Razorpay** | INR payment processing, webhook callbacks |

## Data Flow — Call Session

```
1. User taps astrologer → Flutter calls POST /call/start
2. Backend: callLifecycle.startCall(userId, rate)
           → returns { channel, token } (Agora join credentials)
3. Flutter: joins Agora channel, starts 1s timer
4. User taps "End Call" → Flutter calls POST /call/end
5. Backend: callLifecycle.endCall(session)
           → duration = (now - startTime) / 1000
           → cost = (rate / 60) * duration
           → walletEngine.atomicDeduct(userId, cost)
6. Flutter: pops call screen, refreshes wallet balance
```

## Data Flow — Payment

```
1. User initiates Razorpay payment in Flutter
2. Razorpay processes payment, fires webhook
3. POST /webhook/razorpay receives event
4. Backend verifies HMAC signature
5. On payment.captured: Transaction.create({ type:'credit' })
6. User wallet balance increases
```

## Infrastructure

```
infra/
├── docker/
│   ├── docker-compose.yml     # Local dev: API + DB
│   └── backend.Dockerfile     # Node.js container
└── ci-cd/
    └── flutter.yml            # Flutter CI/CD pipeline
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| In-memory idempotency (not Redis) | Simplicity; acceptable for single-instance deployment |
| Server-side billing | Prevents client-side manipulation of call costs |
| Row-level locking for wallet | Prevents race conditions under concurrent requests |
| Supabase RLS | Zero-trust data isolation at DB layer |
| Agora for voice | Mature RTC SDK with Flutter support |

## Outputs
- Clear mental model for onboarding new developers
- Audit trail for debugging billing/payment issues
- Foundation for future microservices extraction
