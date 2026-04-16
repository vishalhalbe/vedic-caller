require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/db');

const logger = require('./middleware/logger');
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const idempotency = require('./middleware/idempotencyMiddleware_v2');
const authMiddleware = require('./middleware/authMiddleware');

const authRoutes = require('./routes/auth');
const callRoutes = require('./routes/call');
const walletRoutes = require('./routes/wallet');
const astrologerRoutes = require('./routes/astrologer');
const availabilityRoutes = require('./routes/astrologerAvailability');
const callHistoryRoutes = require('./routes/callHistory');
const paymentRoutes = require('./routes/payment_simple');
const webhookRoutes = require('./routes/webhook_v2');
const metricsRoutes = require('./routes/metrics');
const adminRoutes          = require('./routes/admin');
const adminBootstrapRoutes = require('./routes/adminBootstrap');

const app = express();
app.set('trust proxy', 1); // trust first proxy (for X-Forwarded-For in rate limiting)

// CORS — restrict to known origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://10.0.2.2:3000']; // dev fallback only

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));

app.use(logger);
app.use(globalLimiter);

// Webhook MUST be mounted before express.json() — it uses express.raw() internally
app.use('/webhook', webhookRoutes);

// All other routes use JSON body parsing
app.use(express.json());
app.use(idempotency);

app.get('/', (req, res) => res.json({ status: 'JyotishConnect API running' }));
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'connected', uptime: Math.floor(process.uptime()) });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/auth', authLimiter, authRoutes);
app.use('/call', callRoutes);
app.use('/wallet', walletRoutes);
app.use('/astrologer', astrologerRoutes);
app.use('/availability', availabilityRoutes);
app.use('/callHistory', callHistoryRoutes);
app.use('/payment', paymentRoutes);
// Admin bootstrap — secret-gated, no JWT required (creates first admin)
app.use('/admin', adminBootstrapRoutes);
// Admin + metrics — require admin JWT
const { requireAdmin } = require('./middleware/authMiddleware');
app.use('/admin',   authMiddleware, requireAdmin, adminRoutes);
app.use('/metrics', authMiddleware, requireAdmin, metricsRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Catch any unhandled async errors not caught by middleware
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] Unhandled promise rejection:', reason);
  process.exit(1);
});

// Only start the HTTP server when this file is run directly (not when imported by tests)
if (require.main === module) {
  sequelize.authenticate()
    .then(() => {
      console.log('Database connected');
      return sequelize.sync({ alter: false });
    })
    .then(() => {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((err) => {
      console.error('Database connection failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;
