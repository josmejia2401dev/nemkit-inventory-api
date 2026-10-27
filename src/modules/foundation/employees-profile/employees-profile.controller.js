'use strict';

const { success } = require('nemkit');
const { employeesProfileService } = require('./employees-profile.service');
const { profileSchema, passwordSchema } = require('./employees-profile.validator');

/**
 * El empleado autenticado opera sobre SU registro. Bajo el middleware de
 * empleado, `req.user.userId` es el id real del empleado (req.user.id es el
 * tenant para el dominio).
 */
class EmployeesProfileController {
  async get(req, res, next) {
    try {
      return success(res, await employeesProfileService.get(req.user.userId));
    } catch (error) { next(error); }
  }

  async update(req, res, next) {
    try {
      const { errorResponse, sanitized } = profileSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await employeesProfileService.update(req.user.userId, sanitized), 'Profile updated');
    } catch (error) { next(error); }
  }

  async changePassword(req, res, next) {
    try {
      const { errorResponse, sanitized } = passwordSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      await employeesProfileService.changePassword(req.user.userId, sanitized.currentPassword, sanitized.newPassword);
      return success(res, null, 'Password changed successfully');
    } catch (error) { next(error); }
  }
}

module.exports = { EmployeesProfileController, employeesProfileController: new EmployeesProfileController() };
