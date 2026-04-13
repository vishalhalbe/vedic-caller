const express = require('express');
const router = express.Router();

router.post('/start', (req, res) => {
  res.json({ channel: 'demo-channel', token: 'demo-token' });
});

module.exports = router;