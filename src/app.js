'use strict';

const { createApp, requestIdMiddleware, createErrorMiddleware, createCorsMiddleware, RequestContext, createRequestLogger } = require('nemkit');
const { env } = require('./config/env');
const logger = require('./config/logger');
const { mongoClient } = require('./config/db');
const { cache } = require('./config/cache');
const router = require('./routes/index');
const pkg = require('../package.json');

// Prefijo propio para el gateway (`/api/v1/inventory`). Normalizado sin slash
// final para no duplicar separadores en las rutas derivadas.
const API_PREFIX = env.API_PREFIX.replace(/\/+$/, '') || '/';
const prefixed = (path) => (API_PREFIX === '/' ? path : `${API_PREFIX}${path}`);

const app = createApp({
  logger,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: env.RATE_LIMIT_MAX,
  // `/health` y `/ready` también se sirven bajo el prefijo; sin esto el probe
  // prefijado consume rate-limit y ensucia el log.
  skipPaths: ['/', '/health', '/ready', prefixed('/health'), prefixed('/ready')],
  appName: pkg.name,
  appVersion: pkg.version,
  environment: env.NODE_ENV,
});

app.use(requestIdMiddleware);
app.use(RequestContext.middleware());
app.use(createCorsMiddleware({ origins: env.CORS_ORIGINS, logger }));
app.use(createRequestLogger({ logger, enabled: env.REQUEST_LOG_ENABLED }));

const healthHandler = (_req, res) =>
  res.json({ status: 'ok', node: env.APP_NODE_NAME || null, timestamp: Date.now() });

const readyHandler = async (_req, res) => {
  const mongoOk = mongoClient.isReady();
  res.status(mongoOk ? 200 : 503).json({
    status: mongoOk ? 'ready' : 'not ready',
    node: env.APP_NODE_NAME || null,
    probes: {
      mongo: { ok: mongoOk, ...mongoClient.getStats() },
      cache: { status: cache.status(), ...cache.stats() },
    },
  });
};

// Raíz para Compose/local; prefijo para el gateway Tailscale.
app.get(['/health', prefixed('/health')], healthHandler);
app.get(['/ready', prefixed('/ready')], readyHandler);

app.use(API_PREFIX, router);
app.use(createErrorMiddleware({ logger, environment: env.NODE_ENV }));

module.exports = app;
