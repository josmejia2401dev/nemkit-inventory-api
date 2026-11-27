'use strict';

const { createRedisCache } = require('nemkit');
const { env } = require('./env');
const logger = require('./logger');

const CACHE_PREFIX = 'nk:inventory';
const CACHE_VERSION = 'v1';

const CACHE_TTL = Object.freeze({
  apiKey: 30,
  detail: 300,
  catalog: 120,
  dashboard: 30,
  stats: 30,
});

const cache = createRedisCache({
  url: env.REDIS_URL,
  enabled: env.REDIS_ENABLED,
  prefix: `${CACHE_PREFIX}:${CACHE_VERSION}`,
  logger,
});

module.exports = { cache, CACHE_TTL };
