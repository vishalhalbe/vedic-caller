const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Astrologer } = require('../models');

// GET /astrologer?name=<query> — list available astrologers, optional name filter
router.get('/', async (req, res, next) => {
  try {
    const where = { is_available: true };
    if (req.query.name) {
      where.name = { [Op.iLike]: `%${req.query.name}%` };
    }

    const astrologers = await Astrologer.findAll({
      where,
      attributes: ['id', 'name', 'rate_per_minute', 'is_available', 'bio', 'specialization', 'experience_years', 'photo_url'],
      order: [['name', 'ASC']],
    });
    res.json(astrologers);
  } catch (err) {
    next(err);
  }
});


module.exports = router;
