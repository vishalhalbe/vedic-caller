const express = require('express');
const router = express.Router();

router.post('/razorpay', (req, res) => {
  const event = req.body;

  if (event.event === 'payment.captured') {
    // TODO: credit wallet
  }

  res.json({ status: 'ok' });
});

module.exports = router;