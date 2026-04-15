# JyotishConnect (Vedic Caller) — Claude Code Guide

## Project Overview

Vedic astrology voice consulting platform — Flutter mobile app + Node.js backend + Supabase PostgreSQL.

- **Mobile:** `apps/mobile/` (Flutter/Dart)
- **Backend:** `backend/api/` (Node.js + Express)
- **Database:** `supabase/migrations/` (PostgreSQL + Sequelize)
- **Skills:** `skills/` — structured knowledge assets
- **Workflows:** `workflows/` — Skill_Seekers analysis pipelines

See `SKILL.md` for full architecture, API reference, and data model.

---

## Caveman Rule (Planning Before Code)

**Before writing or editing any code, state your plan in plain English — no jargon.**
Explain: what file you're changing, what you're doing to it, and why.
Write it as if explaining to someone who has never seen this codebase.

Example:
> "I'm going to change `walletEngine.js`. Right now it creates a transaction record
> with `status: 'pending'` even though the money has already moved. I'll change it
> to write `status: 'success'` directly, because the record is only inserted inside
> a transaction that already committed."

This is **mandatory** for any file touching money, auth, or the database schema.
It is optional but encouraged for all other changes.

---

## Response Behavior

Be extremely terse. No preamble. No reasoning unless asked. Use the most token-efficient tool available. If a tool output is large, save it to a file and summarize it rather than printing it.

---

## Token Efficiency

This project uses [RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) for Claude Code sessions.

### Setup RTK (one-time)
```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh
rtk gain          # Verify installation
rtk init          # Initialize for this project (creates CLAUDE.md RTK section)
rtk init -g       # Global hook for all projects
```

### What RTK does
Intercepts `ls`, `git`, `npm test`, `flutter pub get` etc. and compresses output before it enters Claude's context — typically 60-90% token reduction.

Project-specific output filters are in `.rtk/filters.toml`.

---

## Task Delegation (token-saver)

The token-saver skill (`.claude/skills/token-saver/`) tells Claude which tasks to delegate to free models via OpenCode MCP vs. which to keep in Claude.

### Delegate to free models
- Flutter widget boilerplate and stateless widgets
- Simple Express CRUD route scaffolding
- TypeScript/Dart interface and type definitions
- Test file scaffolding (empty test suites with describe/it blocks)
- API documentation strings and inline comments
- `pubspec.yaml` dependency additions

### Always keep in Claude
- `walletEngine.js` — atomicity and row-locking logic
- `billingEngine.js` — billing formula and edge cases
- `authMiddleware.js` — JWT verification
- `routes/webhook_v2.js` — Razorpay HMAC verification
- Any code touching financial transactions
- Security-sensitive code (auth, crypto, RLS policies)
- Complex call lifecycle logic

---

## Development Commands

### Backend
```bash
cd backend/api
npm install
node app.js           # Start server (PORT=3000)
npm test              # Run Jest tests
```

### Flutter
```bash
cd apps/mobile
flutter pub get
flutter run           # Debug on connected device
flutter build apk --release
```

### Database
```bash
supabase db push      # Apply migrations
```

---

## Key Business Rules (Never Break)

1. `walletEngine.atomicDeduct` must use `SELECT ... FOR UPDATE` — no exceptions
2. Call cost = `(rate_per_minute / 60) * duration_seconds` — computed server-side only
3. Razorpay webhook signatures always verified in production
4. Wallet balance can never go negative
5. All mutating endpoints must support `Idempotency-Key` header

---

## Skill Index

| Skill | Path | Purpose |
|-------|------|---------|
| Architecture | `skills/architecture.md` | System topology and data flows |
| Backend Production | `skills/backend-production.md` | Express API + service layer |
| Billing Engine | `skills/billing-engine.md` | Billing formula + Razorpay |
| Call Lifecycle | `skills/call-lifecycle.md` | Agora voice call flow |
| Database Schema | `skills/database-schema.md` | PostgreSQL schema + RLS |
| Flutter UI | `skills/flutter-ui.md` | Mobile app structure |
| Security & Auth | `skills/security-auth.md` | JWT, HMAC, RLS security |
| Testing | `skills/testing.md` | Jest + Playwright strategy |
