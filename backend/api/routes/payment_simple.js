// Simplified payment flow (no webhook)
const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');

router.post('/success', async (req, res) => {
  const { user_id, amount, reference } = req.body;

  await Transaction.create({
    user_id,
    amount,
    type: 'credit',
    status: 'success',
    reference
  });

  res.json({ success: true });
});

module.exports = router;