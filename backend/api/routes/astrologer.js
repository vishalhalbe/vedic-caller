const express    = require('express');
const router     = express.Router();
const supabase   = require('../config/db');

router.get('/', async (req, res, next) => {
  try {
    let query = supabase
      .from('astrologers')
      .select('id, name, rate_per_minute, is_available, bio, specialty, years_experience, photo_url')
      .eq('is_available', true)
      .order('name', { ascending: true });

    if (req.query.name) {
      query = query.ilike('name', `%${req.query.name}%`);
    }

    const { data: astrologers, error } = await query;
    if (error) throw new Error(error.message);

    if (!astrologers || astrologers.length === 0) return res.json([]);

    // Fetch avg ratings for listed astrologers
    const ids = astrologers.map(a => a.id);
    const { data: ratings } = await supabase
      .from('astrologer_avg_ratings')
      .select('astrologer_id, avg_rating, rating_count')
      .in('astrologer_id', ids);

    const ratingMap = {};
    (ratings || []).forEach(r => { ratingMap[r.astrologer_id] = r; });

    const result = astrologers.map(a => ({
      ...a,
      avg_rating:   ratingMap[a.id]?.avg_rating  ?? null,
      rating_count: ratingMap[a.id]?.rating_count ?? 0,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /astrologer/:id — public profile with ratings
router.get('/:id', async (req, res, next) => {
  try {
    const { data: astrologer, error } = await supabase
      .from('astrologers')
      .select('id, name, rate_per_minute, is_available, bio, specialty, years_experience, photo_url')
      .eq('id', req.params.id)
      .single();

    if (error || !astrologer) return res.status(404).json({ error: 'Astrologer not found' });

    // Avg rating
    const { data: rating } = await supabase
      .from('astrologer_avg_ratings')
      .select('avg_rating, rating_count')
      .eq('astrologer_id', req.params.id)
      .maybeSingle();

    // Recent reviews (up to 10 most recent rated calls)
    const { data: reviews } = await supabase
      .from('calls')
      .select('rating, rated_at, user_id')
      .eq('astrologer_id', req.params.id)
      .eq('status', 'completed')
      .not('rating', 'is', null)
      .order('rated_at', { ascending: false })
      .limit(10);

    // Batch-fetch seeker names for reviews (single query)
    const userIds = [...new Set((reviews || []).map(r => r.user_id))];
    let nameMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users').select('id, name').in('id', userIds);
      (users || []).forEach(u => { nameMap[u.id] = u.name; });
    }
    const reviewsWithNames = (reviews || []).map(r => ({
      rating:   r.rating,
      rated_at: r.rated_at,
      seeker:   nameMap[r.user_id] ? nameMap[r.user_id].split(' ')[0] : 'Seeker',
    }));

    res.json({
      ...astrologer,
      avg_rating:   rating?.avg_rating ?? null,
      rating_count: rating?.rating_count ?? 0,
      reviews:      reviewsWithNames,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
