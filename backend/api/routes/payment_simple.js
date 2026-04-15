const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { verifyPayment } = require('../services/paymentService');
const { atomicCredit } = require('../services/walletEngine');
const { getRazorpayClient } = require('../services/razorpayClient');

// POST /payment/create-order
// Step 1 of the payment flow — creates a Razorpay order server-side.
// Flutter opens the Razorpay SDK with the returned order_id.
// This is required so the payment signature can be verified in Step 2.
router.post('/create-order', auth, async (req, res, next) => {
  try {
    const { amount } = req.body; // INR
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // In non-production environments, generate a local order_id to avoid
    // calling the live Razorpay API (which requires real credentials + network).
    if (process.env.NODE_ENV !== 'production') {
      const fakeOrderId = `order_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      return res.json({
        order_id: fakeOrderId,
        amount:   Math.round(parsed * 100),
        currency: 'INR',
      });
    }

    const rzp = getRazorpayClient();
    const order = await rzp.orders.create({
      amount: Math.round(parsed * 100), // convert INR → paise
      currency: 'INR',
      notes: { user_id: req.user.id },  // passed back in webhook payload
    });

    res.json({
      order_id: order.id,
      amount:   order.amount,   // paise — pass directly to Razorpay SDK
      currency: order.currency,
    });
  } catch (err) {
    next(err);
  }
});

// POST /payment/success
// Step 2 — called by Flutter after Razorpay SDK reports payment success.
// Verifies HMAC-SHA256(order_id|payment_id, key_secret) before crediting.
router.post('/success', auth, async (req, res, next) => {
  try {
    const { order_id, payment_id, signature, amount } = req.body;

    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({ error: 'order_id, payment_id, and signature required' });
    }

    const valid = verifyPayment(order_id, payment_id, signature);
    if (!valid) return res.status(400).json({ error: 'Invalid payment signature' });

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const result = await atomicCredit(req.user.id, parsedAmount, payment_id);
    res.json({ success: true, balance: result.balance });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
