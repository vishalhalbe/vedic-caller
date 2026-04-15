const express = require('express');
const router = express.Router();
const { User } = require('../models');
const jwt = require('../services/jwt');

router.post('/login', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone required' });

    const [user] = await User.findOrCreate({
      where: { phone },
      defaults: { name: '', wallet_balance: 0 },
    });

    const token = jwt.sign({ id: user.id, phone: user.phone });
    res.json({ token, user_id: user.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
