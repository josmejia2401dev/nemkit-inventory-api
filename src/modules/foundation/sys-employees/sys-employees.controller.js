'use strict';

const { paginated } = require('nemkit');
const { platformEmployeesService } = require('./sys-employees.service');
const { listQuerySchema } = require('./sys-employees.validator');

class PlatformEmployeesController {
  async list(req, res, next) {
    try {
      const { errorResponse, sanitized } = listQuerySchema.check(req.query ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);

      const result = await platformEmployeesService.list(sanitized);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = {
  PlatformEmployeesController,
  platformEmployeesController: new PlatformEmployeesController(),
};
