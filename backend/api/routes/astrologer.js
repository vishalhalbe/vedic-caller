const express    = require('express');
const router     = express.Router();
const supabase   = require('../config/db');

router.get('/', async (req, res, next) => {
  try {
    let query = supabase
      .from('astrologers')
      .select('id, name, rate_per_minute, is_available, bio, specialization, experience_years, photo_url')
      .eq('is_available', true)
      .order('name', { ascending: true });

    if (req.query.name) {
      query = query.ilike('name', `%${req.query.name}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
