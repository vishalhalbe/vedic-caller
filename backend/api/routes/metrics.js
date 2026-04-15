const express = require('express');
const router = express.Router();
const sequelize = require('../config/db');

// GET /metrics — internal metrics (unauthenticated for simplicity, add auth if exposed publicly)
router.get('/', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: Date.now(),
  });
});

// GET /health — load balancer / k8s liveness probe
router.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'connected', uptime: Math.floor(process.uptime()) });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

module.exports = router;
