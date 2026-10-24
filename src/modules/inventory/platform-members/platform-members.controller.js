'use strict';

const { success, created, HttpError } = require('nemkit');
const { platformMembersService } = require('./platform-members.service');
const { associateEmployeeSchema } = require('../employees/employee-association.validator');

class PlatformMembersController {
  async associate(req, res, next) {
    try {
      const { errorResponse, sanitized } = associateEmployeeSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      const employee = await platformMembersService.associate(
        req.params.companyId,
        sanitized.email,
        sanitized.role,
        req.user.id,
      );
      return created(res, employee, 'Employee account associated');
    } catch (error) {
      next(error);
    }
  }

  async disassociate(req, res, next) {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isSafeInteger(userId) || userId < 1) {
        throw HttpError.badRequest('userId must be a positive integer');
      }
      await platformMembersService.disassociate(req.params.companyId, userId, req.user.id);
      return success(res, null, 'Employee account disassociated');
    } catch (error) {
      next(error);
    }
  }

  async employmentHistory(req, res, next) {
    try {
      return success(res, await platformMembersService.employmentHistory(req.params.userId));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = {
  PlatformMembersController,
  platformMembersController: new PlatformMembersController(),
};
