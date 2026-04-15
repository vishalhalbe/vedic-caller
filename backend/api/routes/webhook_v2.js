const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { atomicCredit } = require('../services/walletEngine');

// Razorpay sends raw body — must parse before express.json() strips it.
// Mount this route BEFORE express.json() in app.js, or use express.raw() here.
router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error('[webhook] RAZORPAY_WEBHOOK_SECRET not set — rejecting all webhook calls');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing signature header' });

    const rawBody = req.body; // Buffer from express.raw()
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (signature !== expected) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const userId  = payment.notes?.user_id;

      if (!userId) return res.status(400).json({ error: 'Missing user_id in payment notes' });

      const amountInr = payment.amount / 100; // Razorpay sends paise

      await atomicCredit(userId, amountInr, payment.id);
    }

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
