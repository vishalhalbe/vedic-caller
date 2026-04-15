// Shared helpers for all E2E specs
const crypto = require('crypto');

let _counter = Date.now();
function uniqueEmail() {
  return `e2e_${++_counter}_${Date.now()}@test.jyotishconnect.com`;
}

const DEFAULT_PASSWORD = 'TestPass99!';

/**
 * Register a new user and return { token, userId }.
 * Each call creates a fresh user so tests stay independent.
 */
async function register(request) {
  const email = uniqueEmail();
  const res = await request.post('/auth/register', {
    data: { email, password: DEFAULT_PASSWORD },
  });
  const body = await res.json();
  return { token: body.token, userId: body.user_id, email };
}

/** Auth header object ready for request.fetch options */
function auth(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

/**
 * Compute a valid Razorpay payment signature for tests.
 * Mirrors backend/api/services/paymentService.js
 */
function razorpaySignature(orderId, paymentId) {
  const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

/**
 * Simulate a successful Razorpay payment end-to-end:
 *   1. Create server-side order
 *   2. Compute a valid signature locally
 *   3. POST /payment/success
 * Returns the updated wallet balance.
 */
async function topUpWallet(request, token, amountInr) {
  // Step 1: create order
  const orderRes = await request.post('/payment/create-order', {
    data: { amount: amountInr },
    headers: { Authorization: `Bearer ${token}` },
  });
  const order = await orderRes.json();

  // Step 2: fake payment_id and compute signature
  const paymentId = `pay_test_${Date.now()}`;
  const signature = razorpaySignature(order.order_id, paymentId);

  // Step 3: confirm
  const confirmRes = await request.post('/payment/success', {
    data: {
      order_id:   order.order_id,
      payment_id: paymentId,
      signature,
      amount:     amountInr,
    },
    headers: { Authorization: `Bearer ${token}` },
  });
  const confirmed = await confirmRes.json();
  return { status: confirmRes.status(), balance: confirmed.balance, paymentId, orderId: order.order_id };
}

module.exports = { register, auth, razorpaySignature, topUpWallet, uniqueEmail };
