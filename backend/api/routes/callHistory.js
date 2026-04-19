const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/authMiddleware');
const supabase   = require('../config/db');

router.get('/', auth, async (req, res, next) => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const page   = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('calls')
      .select('*, astrologers(name, rate_per_minute)', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    res.json({
      data:       data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
