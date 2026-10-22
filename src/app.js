'use strict';

const { createApp, requestIdMiddleware, createErrorMiddleware, createCorsMiddleware, RequestContext, createRequestLogger } = require('nemkit');
const { env } = require('./config/env');
const logger = require('./config/logger');
const { mongoClient } = require('./config/db');
const router = require('./routes/index');
const pkg = require('../package.json');

const app = createApp({
  logger,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: env.RATE_LIMIT_MAX,
  appName: pkg.name,
  appVersion: pkg.version,
  environment: env.NODE_ENV,
});

app.use(requestIdMiddleware);
app.use(RequestContext.middleware());
app.use(createCorsMiddleware({ origins: env.CORS_ORIGINS, logger }));
app.use(createRequestLogger({ logger, enabled: env.REQUEST_LOG_ENABLED }));

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.get('/ready', async (_req, res) => {
  const mongoOk = mongoClient.isReady();
  res.status(mongoOk ? 200 : 503).json({
    status: mongoOk ? 'ready' : 'not ready',
    probes: { mongo: { ok: mongoOk, ...mongoClient.getStats() } },
  });
});

app.use(env.API_PREFIX, router);
app.use(createErrorMiddleware({ logger, environment: env.NODE_ENV }));

module.exports = app;
