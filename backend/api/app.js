require('dotenv').config();

// ── Env-var validation — fail fast before any I/O ────────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_KEY', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[startup] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const express  = require('express');
const cors     = require('cors');
const supabase = require('./config/db');

const loggerMiddleware = require('./middleware/logger');
const { logger }       = loggerMiddleware;
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter');
const errorHandler  = require('./middleware/errorHandler');
const idempotency   = require('./middleware/idempotencyMiddleware_v2');
const authMiddleware = require('./middleware/authMiddleware');

const authRoutes         = require('./routes/auth');
const callRoutes         = require('./routes/call');
const walletRoutes       = require('./routes/wallet');
const astrologerRoutes   = require('./routes/astrologer');
const availabilityRoutes = require('./routes/astrologerAvailability');
const callHistoryRoutes  = require('./routes/callHistory');
const paymentRoutes      = require('./routes/payment_simple');
const webhookRoutes      = require('./routes/webhook_v2');
const metricsRoutes      = require('./routes/metrics');
const adminRoutes          = require('./routes/admin');
const adminBootstrapRoutes = require('./routes/adminBootstrap');
const astrologerAuthRoutes = require('./routes/astrologerAuth');
const astrologerMeRoutes   = require('./routes/astrologerMe');

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:8282'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
}));

app.use(loggerMiddleware);
app.use(globalLimiter);

// Webhook MUST be mounted before express.json() — it uses express.raw() internally
app.use('/webhook', webhookRoutes);

app.use(express.json());
app.use(idempotency);

app.get('/', (req, res) => res.json({ status: 'JyotishConnect API running' }));
app.get('/health', async (req, res) => {
  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', db: 'connected', uptime: Math.floor(process.uptime()) });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// authLimiter on login/register/refresh only — logout excluded (DoS via NAT IP exhaustion)
app.use('/auth', (req, res, next) => {
  if (req.path === '/logout') return next();
  return authLimiter(req, res, next);
}, authRoutes);
app.use('/call', callRoutes);
app.use('/wallet', walletRoutes);
app.use('/astrologer/auth', authLimiter, astrologerAuthRoutes);
app.use('/astrologer', astrologerMeRoutes);
app.use('/astrologer', astrologerRoutes);
app.use('/availability', availabilityRoutes);
app.use('/callHistory', callHistoryRoutes);
app.use('/payment', paymentRoutes);
app.use('/admin', adminBootstrapRoutes);

const { requireAdmin } = require('./middleware/authMiddleware');
app.use('/admin',   authMiddleware, requireAdmin, adminRoutes);
app.use('/metrics', authMiddleware, requireAdmin, metricsRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

if (require.main === module) {
  supabase.from('users').select('id').limit(1)
    .then(({ error }) => {
      if (error) throw error;
      logger.info('Supabase connected');
      app.listen(PORT, () => logger.info({ port: PORT }, 'Server running'));
    })
    .catch((err) => {
      logger.error({ err }, 'Supabase connection failed');
      process.exit(1);
    });
}

module.exports = app;
