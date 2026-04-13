const { check, save } = require('../services/idempotencyService');

module.exports = (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) return next();

  const cached = check(key);
  if (cached) return res.json(cached);

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    save(key, body);
    return originalJson(body);
  };

  next();
};