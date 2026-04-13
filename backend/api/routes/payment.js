const express = require('express');
const router = express.Router();
const { verifySignature } = require('../services/razorpayService');

router.post('/verify', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields' });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Payment configuration error' });
  }

  const valid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, secret);

  if (!valid) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  res.json({ success: true });
});

module.exports = router;
