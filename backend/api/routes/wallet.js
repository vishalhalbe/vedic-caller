const express = require('express');
const router = express.Router();

router.post('/deduct', (req, res) => {
  const { balance, rate, seconds } = req.body;
  const cost = (rate / 60) * seconds;
  res.json({ remaining: balance - cost });
});

module.exports = router;