const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { verifyPayment } = require('../services/paymentService');
const { atomicCredit } = require('../services/walletEngine');
const { getRazorpayClient } = require('../services/razorpayClient');
const { Order } = require('../models');

// POST /payment/create-order
// Step 1 of the payment flow — creates a Razorpay order server-side and stores
// the amount in the DB so /payment/success can verify it hasn't been tampered with.
router.post('/create-order', auth, async (req, res, next) => {
  try {
    const { amount } = req.body; // INR
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    let orderId;

    // In non-production environments, generate a local order_id to avoid
    // calling the live Razorpay API (which requires real credentials + network).
    if (process.env.NODE_ENV !== 'production') {
      orderId = `order_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    } else {
      const rzp = getRazorpayClient();
      const order = await rzp.orders.create({
        amount: Math.round(parsed * 100), // convert INR → paise
        currency: 'INR',
        notes: { user_id: req.user.id },
      });
      orderId = order.id;
    }

    // Persist order so amount can be verified at /payment/success
    await Order.create({
      id:      orderId,
      user_id: req.user.id,
      amount:  parsed,
      status:  'created',
    });

    res.json({
      order_id: orderId,
      amount:   Math.round(parsed * 100), // paise — pass directly to Razorpay SDK
      currency: 'INR',
    });
  } catch (err) {
    next(err);
  }
});

// POST /payment/success
// Step 2 — called by Flutter after Razorpay SDK reports payment success.
// Verifies HMAC-SHA256(order_id|payment_id, key_secret) before crediting.
// The amount credited is the server-stored order amount, NOT the client-supplied value.
router.post('/success', auth, async (req, res, next) => {
  try {
    const { order_id, payment_id, signature } = req.body;

    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({ error: 'order_id, payment_id, and signature required' });
    }

    const valid = verifyPayment(order_id, payment_id, signature);
    if (!valid) return res.status(400).json({ error: 'Invalid payment signature' });

    // Look up the server-stored order — reject if not found or already paid
    const order = await Order.findOne({ where: { id: order_id, user_id: req.user.id } });
    if (!order) return res.status(400).json({ error: 'Order not found' });
    if (order.status === 'paid') {
      // Already credited (idempotent re-delivery)
      const { User } = require('../models');
      const user = await User.findByPk(req.user.id, { attributes: ['wallet_balance'] });
      return res.json({ success: true, balance: parseFloat(user.wallet_balance) });
    }

    const storedAmount = parseFloat(order.amount);

    const result = await atomicCredit(req.user.id, storedAmount, payment_id);

    // Mark order as paid
    await order.update({ status: 'paid' });

    res.json({ success: true, balance: result.balance });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
