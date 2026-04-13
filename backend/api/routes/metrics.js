const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now()
  });
});

module.exports = router;