'use strict';

const { HttpError } = require('nemkit');
const { scopeCompany } = require('./users.middleware');
const { scopeEmployee } = require('./employees.middleware');

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
