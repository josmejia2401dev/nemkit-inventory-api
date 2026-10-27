'use strict';

const { RequestContext, RECORD_STATUS, HttpError } = require('nemkit');
const { employeesService } = require('../modules/foundation/employees/employees.service');
const { usersService } = require('../modules/foundation/users/users.service');

async function scopeEmployee(req) {
  const actorId = req.user.id;
  const userId = await employeesService.resolveUserForAccount(actorId);
  const company = await usersService.findById(userId);
  if (!company || company.recordStatus !== RECORD_STATUS.ACTIVE) {
    throw HttpError.forbidden('The associated company account is unavailable');
  }

  req.user.actorId = actorId;
  req.user.id = userId;
  req.user.userId = userId;
  req.user.employeeId = actorId;
  req.user.businessType = company.businessType ?? 'retail';
  RequestContext.setUserId(actorId);
  RequestContext.set('scopeUserId', userId);
}

async function requireEmployee(req, _res, next) {
  try {
    if (req.user?.employeeId == null) {
      return next(HttpError.forbidden('This space is for employee accounts'));
    }

    await scopeEmployee(req);
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { scopeEmployee, requireEmployee };
