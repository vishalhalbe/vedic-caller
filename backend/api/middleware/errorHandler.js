const isProd = process.env.NODE_ENV === 'production';

module.exports = (err, req, res, next) => {
  const status = err.status || 500;

  // Always log internally
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}`, err);

  // Consistent error response shape: { error: 'message' }
  const message = isProd && status === 500
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');

  res.status(status).json({ error: message });
};
