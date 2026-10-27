'use strict';

const { RequestContext, HttpError } = require('nemkit');

function requireSuperAdmin(req, _res, next) {
  if (!(req.user?.roles ?? []).includes('SUPERADMIN')) {
    return next(HttpError.forbidden('Super admin access required'));
  }

  RequestContext.setUserId(req.user.id);
  return next();
}

module.exports = { requireSuperAdmin };
