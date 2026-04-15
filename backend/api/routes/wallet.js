const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { User } = require('../models');
const { atomicDeduct } = require('../services/walletEngine');

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

// POST /wallet/deduct — atomically deduct an amount from wallet
router.post('/deduct', auth, async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const result = await atomicDeduct(req.user.id, parseFloat(amount));
    res.json(result);
  } catch (err) {
    if (err.message === 'Insufficient balance' || err.message === 'User not found') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
