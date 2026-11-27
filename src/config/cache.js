'use strict';

const { createRedisCache } = require('nemkit');
const { env } = require('./env');
const logger = require('./logger');

const cache = createRedisCache({
  url: env.REDIS_URL,
  enabled: env.REDIS_ENABLED,
  prefix: `${env.CACHE_PREFIX}:${env.CACHE_VERSION}`,
  connectTimeoutMs: env.REDIS_CONNECT_TIMEOUT_MS,
  commandTimeoutMs: env.REDIS_COMMAND_TIMEOUT_MS,
  circuitFailures: env.REDIS_CIRCUIT_FAILURES,
  circuitOpenMs: env.REDIS_CIRCUIT_OPEN_MS,
  probeIntervalMs: env.REDIS_PROBE_INTERVAL_MS,
  logger,
});

const CACHE_TTL = Object.freeze({
  apiKey: env.CACHE_TTL_API_KEY_SECONDS,
  detail: env.CACHE_TTL_DETAIL_SECONDS,
  catalog: env.CACHE_TTL_CATALOG_SECONDS,
  dashboard: env.CACHE_TTL_DASHBOARD_SECONDS,
  stats: env.CACHE_TTL_STATS_SECONDS,
});

module.exports = { cache, CACHE_TTL };
