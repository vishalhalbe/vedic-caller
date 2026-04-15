-- Orders table: stores server-side amount at order creation so /payment/success
-- can verify the client hasn't tampered with the amount.
CREATE TABLE IF NOT EXISTS orders (
  id         TEXT PRIMARY KEY,                      -- Razorpay order_id
  user_id    UUID NOT NULL REFERENCES users(id),
  amount     NUMERIC(10, 2) NOT NULL,               -- INR, stored at creation
  currency   TEXT NOT NULL DEFAULT 'INR',
  status     TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
