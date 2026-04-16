const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { Call, Astrologer } = require('../models');

// GET /callHistory?page=1&limit=20 — paginated call history for authenticated user
router.get('/', auth, async (req, res, next) => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit)  || 20, 1), 100);
    const page   = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const { count, rows } = await Call.findAndCountAll({
      where:   { user_id: req.user.id },
      include: [{ model: Astrologer, attributes: ['name', 'rate_per_minute'] }],
      order:   [['created_at', 'DESC']],
      limit,
      offset,
    });

    res.json({
      data:       rows,
      pagination: {
        total:    count,
        page,
        limit,
        pages:    Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
