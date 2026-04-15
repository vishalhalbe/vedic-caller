const isProd = process.env.NODE_ENV === 'production';

module.exports = (err, req, res, next) => {
  const status = err.status || 500;

  // Always log internally
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}`, err);

  if (isProd && status === 500) {
    // Never leak internal error details to clients in production
    return res.status(500).json({ error: true, message: 'Internal Server Error' });
  }

  res.status(status).json({
    error: true,
    message: err.message || 'Internal Server Error',
  });
};
