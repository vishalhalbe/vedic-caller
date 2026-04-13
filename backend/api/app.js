require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/db');

const logger = require('./middleware/logger');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const idempotency = require('./middleware/idempotencyMiddleware_v2');

const authRoutes = require('./routes/auth');
const callRoutes = require('./routes/call');
const walletRoutes = require('./routes/wallet');
const astrologerRoutes = require('./routes/astrologer');
const availabilityRoutes = require('./routes/astrologerAvailability');
const callHistoryRoutes = require('./routes/callHistory');
const paymentRoutes = require('./routes/payment_simple');
const webhookRoutes = require('./routes/webhook_v2');
const metricsRoutes = require('./routes/metrics');

const app = express();

app.use(cors());
app.use(logger);
app.use(rateLimiter);
app.use(express.json());
app.use(idempotency);

app.get('/', (req, res) => res.json({ status: 'JyotishConnect API running' }));

app.use('/auth', authRoutes);
app.use('/call', callRoutes);
app.use('/wallet', walletRoutes);
app.use('/astrologer', astrologerRoutes);
app.use('/availability', availabilityRoutes);
app.use('/callHistory', callHistoryRoutes);
app.use('/payment', paymentRoutes);
app.use('/webhook', webhookRoutes);
app.use('/metrics', metricsRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

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
    app.listen(PORT, () => console.log(`Server running on port ${PORT} (no DB)`));
  });

module.exports = app;
