const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');

router.post('/razorpay', async (req, res) => {
  const event = req.body;

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;

    await Transaction.create({
      user_id: payment.notes?.user_id,
      amount: payment.amount / 100,
      type: 'credit',
      status: 'success',
      reference: payment.id
    });
  }

  res.json({ status: 'ok' });
});

module.exports = router;