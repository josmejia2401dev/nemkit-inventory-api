'use strict';

const { createAuthMiddleware, extractBearerToken, JwtManager } = require('nemkit');
const { env } = require('../config/env');
const logger = require('../config/logger');
const { tokensService } = require('../modules/foundation/tokens/tokens.service');

const jwtManager = new JwtManager({
  accessSecret: env.JWT_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: env.JWT_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
});

const authenticateToken = createAuthMiddleware({
  jwtManager,
  logger,
  isBlacklisted: (jti) => tokensService.isSessionRevoked(jti),
});

/**
 * nemkit valida el token, pero su req.user omite claims propios del dominio.
 * Los recuperamos del mismo JWT ya validado para que los guards distingan
 * sesiones de empleados y resuelvan la empresa asociada.
 */
const authenticate = (req, res, next) => authenticateToken(req, res, (error) => {
  if (error) return next(error);

  try {
    const token = extractBearerToken(req);
    const claims = jwtManager.verifyAccessToken(token);

    req.user = {
      ...req.user,
      type: claims.type ?? null,
      userId: claims.userId ?? null,
      employeeId: claims.employeeId ?? null,
      businessType: claims.businessType ?? null,
    };

    return next();
  } catch (verificationError) {
    return next(verificationError);
  }
});

module.exports = { authenticate, jwtManager };
