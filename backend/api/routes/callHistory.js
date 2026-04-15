const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { Call, Astrologer } = require('../models');

// GET /callHistory — return call history for authenticated user
router.get('/', auth, async (req, res, next) => {
  try {
    const calls = await Call.findAll({
      where: { user_id: req.user.id },
      include: [{ model: Astrologer, attributes: ['name', 'rate_per_minute'] }],
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    res.json(calls);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
