const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { atomicCredit } = require('../services/walletEngine');
const { Order } = require('../models');

// Razorpay sends raw body — must parse before express.json() strips it.
// Mount this route BEFORE express.json() in app.js, or use express.raw() here.
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error('[webhook] RAZORPAY_WEBHOOK_SECRET not set — webhook not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing signature header' });

    const rawBody = req.body; // Buffer from express.raw()
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const sigBuf      = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expected,   'hex');
    const valid = sigBuf.length === expectedBuf.length &&
                  crypto.timingSafeEqual(sigBuf, expectedBuf);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const userId  = payment.notes?.user_id;
      const orderId = payment.order_id;

      if (!userId) return res.status(400).json({ error: 'Missing user_id in payment notes' });

      // Amount MUST come from the server-stored order — reject if order is missing
      if (!orderId) return res.status(400).json({ error: 'Missing order_id in payment' });
      const order = await Order.findByPk(orderId);
      if (!order) {
        console.error(`[webhook] order ${orderId} not found — payment ${payment.id} not credited`);
        return res.status(400).json({ error: 'Order not found' });
      }

      const amountInr = parseFloat(order.amount);
      await atomicCredit(userId, amountInr, payment.id);

      // Mark order as paid so /payment/success won't attempt a second credit
      if (order.status !== 'paid') {
        await order.update({ status: 'paid' });
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
