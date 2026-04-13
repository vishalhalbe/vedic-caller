const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  res.json({ success: true, token: 'demo-token' });
});

module.exports = router;