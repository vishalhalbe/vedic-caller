const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { verifyPayment } = require('../services/paymentService');
const { atomicCredit } = require('../services/walletEngine');

// POST /payment/success — verify Razorpay payment then credit wallet
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
