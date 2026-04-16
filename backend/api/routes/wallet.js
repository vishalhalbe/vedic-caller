const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { User } = require('../models');
const { atomicCredit } = require('../services/walletEngine');

// GET /wallet/balance — return current balance for authenticated user
router.get('/balance', auth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'wallet_balance'],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ balance: parseFloat(user.wallet_balance) });
  } catch (err) {
    next(err);
  }
});

// POST /wallet/test-credit — direct credit for E2E / integration tests only.
// NEVER available in production.
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-credit', auth, async (req, res, next) => {
    try {
      const { amount } = req.body;
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      const ref = `test_credit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const result = await atomicCredit(req.user.id, parseFloat(amount), ref);
      res.json({ balance: result.balance });
    } catch (err) {
      next(err);
    }
  });
}

module.exports = router;
