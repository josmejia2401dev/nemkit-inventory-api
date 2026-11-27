'use strict';

const { HttpError } = require('nemkit');
const { foundation } = require('../config/foundation');
const { scopeCompany, scopeEmployee } = foundation.middlewares;

async function scopeToUser(req, _res, next) {
  try {
    if ((req.user?.roles ?? []).includes('SUPERADMIN') && req.user?.employeeId == null) {
      return next(HttpError.forbidden('Super admin has no operational company user'));
    }

    if (req.user?.employeeId != null) {
      await scopeEmployee(req);
    } else {
      await scopeCompany(req);
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { scopeToUser };
