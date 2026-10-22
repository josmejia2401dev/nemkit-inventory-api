'use strict';

const { HttpError } = require('nemkit');

/**
 * Middleware de autorización por rol.
 * Debe ir DESPUÉS de authenticate (que setea req.user).
 *
 * @param {...string} allowedRoles - roles permitidos (ej: 'ADMIN')
 *
 * @example
 * router.get('/logs', authenticate, requireRole('ADMIN'), ctrl.list);
 */
function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    const userRoles = req.user?.roles ?? [];
    const ok = allowedRoles.some((r) => userRoles.includes(r));
    if (!ok) return next(HttpError.forbidden('Insufficient permissions'));
    next();
  };
}

module.exports = { requireRole };
