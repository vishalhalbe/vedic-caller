# Skill: Database Schema & RLS (JyotishConnect)

## Goal
Understand and work safely with the JyotishConnect PostgreSQL schema — including table structure, relationships, indexes, and Supabase Row Level Security policies that enforce data isolation.

## Schema Overview

```
users ──────────── calls ──────────── astrologers
  │                  │
  │            transactions
  │
  └── transactions
```

### `users`
App users (seekers who book consultations):
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
phone           text UNIQUE NOT NULL
name            text DEFAULT ''
wallet_balance  numeric(10,2) DEFAULT 0
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### `astrologers`
Astrologer profiles available for booking:
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text NOT NULL
rate_per_minute numeric(8,2) NOT NULL DEFAULT 50
is_available    boolean DEFAULT false
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

Seed data:
```sql
('Pt. Sharma', 35, true), ('Jyotika Devi', 75, true),
('Acharya Ramesh', 50, false), ('Dr. Meena Joshi', 100, true)
```

### `calls`
Consultation records linking users and astrologers:
```sql
id               uuid PRIMARY KEY
user_id          uuid NOT NULL REFERENCES users(id)
astrologer_id    uuid NOT NULL REFERENCES astrologers(id)
duration_seconds integer DEFAULT 0
cost             numeric(10,2) DEFAULT 0
status           text DEFAULT 'pending'    -- pending|active|completed|failed
started_at       timestamptz
ended_at         timestamptz
created_at       timestamptz DEFAULT now()
```

### `transactions`
Wallet ledger — every credit and debit:
```sql
id         uuid PRIMARY KEY
user_id    uuid NOT NULL REFERENCES users(id)
amount     numeric(10,2) NOT NULL
type       text NOT NULL DEFAULT 'credit'   -- credit|debit
status     text NOT NULL DEFAULT 'pending'  -- success|failed|pending
reference  text DEFAULT ''                  -- Razorpay payment ID
created_at timestamptz DEFAULT now()
```

## Indexes

```sql
idx_calls_user_id         ON calls(user_id)
idx_calls_astrologer_id   ON calls(astrologer_id)
idx_transactions_user_id  ON transactions(user_id)
```

## Row Level Security (RLS)

All tables have RLS enabled. Policies enforce strict data ownership:

| Table | Policy | Rule |
|-------|--------|------|
| `users` | SELECT | `auth.uid() = id` |
| `users` | UPDATE | `auth.uid() = id` |
| `users` | INSERT | `auth.uid() = id` |
| `astrologers` | SELECT | `true` (public — browse marketplace) |
| `calls` | SELECT | `auth.uid() = user_id` |
| `calls` | INSERT | `auth.uid() = user_id` |
| `calls` | UPDATE | `auth.uid() = user_id` |
| `transactions` | SELECT | `auth.uid() = user_id` |
| `transactions` | INSERT | `auth.uid() = user_id` |

## Common Queries

### Get user wallet balance
```sql
SELECT wallet_balance FROM users WHERE id = :userId;
```

### Atomic deduction (with row lock)
```sql
BEGIN;
SELECT balance FROM wallets WHERE user_id = :userId FOR UPDATE;
UPDATE wallets SET balance = balance - :amount WHERE user_id = :userId;
INSERT INTO transactions (user_id, amount, type, status) VALUES (:userId, :amount, 'debit', 'success');
COMMIT;
```

### User call history
```sql
SELECT c.*, a.name AS astrologer_name
FROM calls c
JOIN astrologers a ON c.astrologer_id = a.id
WHERE c.user_id = :userId
ORDER BY c.created_at DESC;
```

### Available astrologers
```sql
SELECT id, name, rate_per_minute FROM astrologers WHERE is_available = true;
```

## Migration

Schema lives in:
```
supabase/migrations/20260413125055_create_jyotishconnect_schema.sql
```

Apply with:
```bash
supabase db push          # via Supabase CLI
# or via Sequelize:
sequelize db:migrate
```

## Rules

- **Never modify `wallet_balance` directly** — always go through `walletEngine.atomicDeduct` or equivalent
- **Always create a Transaction record** alongside any balance change
- **RLS is the final security layer** — even if API auth is bypassed, users cannot read others' data
- **`astrologers` is public** — any authenticated user can browse rates and availability
- **`calls.status`** valid values: `pending`, `active`, `completed`, `failed`

## Outputs
- Safe, auditable financial data
- Zero data leakage between users
- Full call and payment history per user
