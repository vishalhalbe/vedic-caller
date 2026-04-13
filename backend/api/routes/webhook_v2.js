const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Transaction = require('../models/transaction');

router.post('/razorpay', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (secret) {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (signature !== expected) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  }

  const event = req.body;

  try {
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const userId = payment.notes?.user_id;

      if (!userId) {
        return res.status(400).json({ error: 'Missing user_id in payment notes' });
      }

      await Transaction.create({
        user_id: userId,
        amount: payment.amount / 100,
        type: 'credit',
        status: 'success',
        reference: payment.id
      });
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
