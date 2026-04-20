const pinoHttp = require('pino-http');
const pino     = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});

module.exports = pinoHttp({ logger, autoLogging: process.env.NODE_ENV !== 'test' });
module.exports.logger = logger;
