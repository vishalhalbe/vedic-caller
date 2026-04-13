/*
  # JyotishConnect Core Schema

  ## New Tables
  - `users` - App users (seekers) with wallet balance
  - `astrologers` - Astrologer profiles with rate and availability
  - `calls` - Call records linking users and astrologers
  - `transactions` - Wallet credit/debit ledger

  ## Columns
  ### users
    - id (uuid, PK)
    - phone (text, unique, not null)
    - name (text)
    - wallet_balance (numeric, default 0)
    - created_at, updated_at

  ### astrologers
    - id (uuid, PK)
    - name (text, not null)
    - rate_per_minute (numeric, not null)
    - is_available (boolean, default false)
    - created_at, updated_at

  ### calls
    - id (uuid, PK)
    - user_id (uuid, FK -> users)
    - astrologer_id (uuid, FK -> astrologers)
    - duration_seconds (integer, default 0)
    - cost (numeric, default 0)
    - status (text, default 'pending')
    - started_at, ended_at, created_at

  ### transactions
    - id (uuid, PK)
    - user_id (uuid, FK -> users)
    - amount (numeric, not null)
    - type (text: 'credit' | 'debit')
    - status (text: 'success' | 'failed' | 'pending')
    - reference (text)
    - created_at

  ## Security
  - RLS enabled on all tables
  - Users can only read/update their own record
  - Users can only read their own calls and transactions
  - Astrologers table is publicly readable (browse marketplace)
  - All writes require authentication
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text DEFAULT '',
  wallet_balance numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS astrologers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rate_per_minute numeric(8,2) NOT NULL DEFAULT 50,
  is_available boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  astrologer_id uuid NOT NULL REFERENCES astrologers(id),
  duration_seconds integer DEFAULT 0,
  cost numeric(10,2) DEFAULT 0,
  status text DEFAULT 'pending',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  amount numeric(10,2) NOT NULL,
  type text NOT NULL DEFAULT 'credit',
  status text NOT NULL DEFAULT 'pending',
  reference text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_astrologer_id ON calls(astrologer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE astrologers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone authenticated can read astrologers"
  ON astrologers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read own calls"
  ON calls FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calls"
  ON calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calls"
  ON calls FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

INSERT INTO astrologers (name, rate_per_minute, is_available) VALUES
  ('Pt. Sharma', 35, true),
  ('Jyotika Devi', 75, true),
  ('Acharya Ramesh', 50, false),
  ('Dr. Meena Joshi', 100, true)
ON CONFLICT DO NOTHING;
