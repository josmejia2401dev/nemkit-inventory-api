'use strict';

const { success, created, paginated } = require('nemkit');
const { employeePaymentsService: service } = require('./employee-payments.service');
const { statisticsService } = require('../statistics/statistics.service');
const { listQuerySchema, createPaymentSchema } = require('./employee-payments.validator');

class EmployeePaymentsController {
  async list(req, res, next) {
    try {
      const { errorResponse, sanitized } = listQuerySchema.check(req.query, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      const result = await service.list(req.user.id, sanitized);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async summary(req, res, next) {
    try {
      const { errorResponse, sanitized } = listQuerySchema.check(req.query, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await statisticsService.employeePaymentsSummary(req.user.id, sanitized));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = createPaymentSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(res, await service.create(sanitized, req.user.id, {
        id: req.user.employeeId || req.user.id,
        name: req.user.fullName || '',
      }));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { employeePaymentsController: new EmployeePaymentsController() };
