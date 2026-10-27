'use strict';

const { RequestContext, RECORD_STATUS, HttpError } = require('nemkit');
const { usersService } = require('../modules/foundation/users/users.service');
const { scopeEmployee } = require('./employees.middleware');

async function scopeCompany(req) {
  const actorId = req.user.id;
  const account = await usersService.findById(actorId);
  if (!account || account.recordStatus !== RECORD_STATUS.ACTIVE) {
    throw HttpError.forbidden('This user account is inactive');
  }

  const userId = account.userId ?? actorId;
  req.user.actorId = actorId;
  req.user.id = userId;
  req.user.userId = userId;
  req.user.roles = account.roles ?? [];
  req.user.employeeId = null;
  req.user.businessType = account.businessType ?? 'retail';
  RequestContext.setUserId(actorId);
  RequestContext.set('scopeUserId', userId);
}

async function requireCompany(req, _res, next) {
  try {
    if (req.user?.employeeId != null || (req.user?.roles ?? []).includes('SUPERADMIN')) {
      return next(HttpError.forbidden('This space is for company accounts'));
    }

    await scopeCompany(req);
    return next();
  } catch (error) {
    return next(error);
  }
}

async function requireCompanyOrSuperAdmin(req, _res, next) {
  if (req.user?.employeeId == null && (req.user?.roles ?? []).includes('SUPERADMIN')) {
    RequestContext.setUserId(req.user.id);
    return next();
  }

  return requireCompany(req, _res, next);
}

async function requireCompanyAdmin(req, _res, next) {
  try {
    if ((req.user?.roles ?? []).includes('SUPERADMIN')) {
      return next(HttpError.forbidden('This space is for company administrators'));
    }

    if (req.user?.employeeId != null) {
      if (!(req.user?.roles ?? []).includes('ADMIN')) {
        return next(HttpError.forbidden('Company administrator access required'));
      }

      await scopeEmployee(req);
      return next();
    }

    await scopeCompany(req);
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  scopeCompany,
  requireCompany,
  requireCompanyOrSuperAdmin,
  requireCompanyAdmin,
};
