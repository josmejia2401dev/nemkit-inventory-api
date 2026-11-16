'use strict';

const { success, created, paginated } = require('nemkit');
const { cashWithdrawalsService: service } = require('./cash-withdrawals.service');
const {
  listWithdrawalsQuerySchema,
  summaryQuerySchema,
  createWithdrawalSchema,
} = require('./cash-withdrawals.validator');

class CashWithdrawalsController {
  async list(req, res, next) {
    try {
      const { errorResponse, sanitized } = listWithdrawalsQuerySchema.check(req.query, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      const result = await service.list(req.user.id, sanitized);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async summary(req, res, next) {
    try {
      const { errorResponse, sanitized } = summaryQuerySchema.check(req.query, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await service.summary(req.user.id, sanitized));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = createWithdrawalSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(res, await service.create(sanitized, req.user.id, {
        id: req.user.employeeId || req.user.id,
        name: req.user.fullName || '',
      }));
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      return success(res, await service.remove(req.params.id, req.user.id));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { cashWithdrawalsController: new CashWithdrawalsController() };
