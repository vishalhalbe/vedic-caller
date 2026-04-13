const express = require('express');
const router = express.Router();

router.post('/verify', (req, res) => {
  // TODO: Razorpay signature verification
  res.json({ success: true });
});

module.exports = router;