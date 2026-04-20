const express    = require('express');
const router     = express.Router();
const supabase   = require('../config/db');

router.get('/', (req, res) => {
  res.json({
    uptime:    process.uptime(),
    memory:    process.memoryUsage(),
    timestamp: Date.now(),
  });
});

router.get('/health', async (req, res) => {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', db: 'connected', uptime: Math.floor(process.uptime()) });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

module.exports = router;
