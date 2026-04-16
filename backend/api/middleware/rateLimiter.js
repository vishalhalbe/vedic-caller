const rateLimit = require('express-rate-limit');

const passThrough = (_req, _res, next) => next();

// Disable rate limiting in test environment to prevent 429s during test runs
const globalLimiter = process.env.NODE_ENV === 'test' ? passThrough : rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tight limiter for auth endpoints — brute-force protection
const authLimiter = process.env.NODE_ENV === 'test' ? passThrough : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { globalLimiter, authLimiter };
