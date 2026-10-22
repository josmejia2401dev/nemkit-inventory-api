'use strict';

const { createAuthMiddleware, JwtManager } = require('nemkit');
const { env } = require('../config/env');
const logger = require('../config/logger');

const jwtManager = new JwtManager({
  accessSecret: env.JWT_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: env.JWT_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
});

const authenticate = createAuthMiddleware({ jwtManager, logger });

module.exports = { authenticate, jwtManager };
