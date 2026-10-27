'use strict';

const { success, paginated } = require('nemkit');
const { reportsService } = require('./reports.service');
const {
  movementsQuerySchema,
  salesQuerySchema,
  salesByEmployeeQuerySchema,
  cancelledSalesQuerySchema,
} = require('./reports.validator');

function check(schema, req, res) {
  const result = schema.check(req.query ?? {}, req);
  if (result.errorResponse) {
    res.status(400).json(result.errorResponse);
    return null;
  }
  return result.sanitized;
}

class ReportsController {
  async inventory(req, res, next) {
    try {
      const report = await reportsService.inventory(req.user.id);
      return success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async movements(req, res, next) {
    try {
      const query = check(movementsQuerySchema, req, res);
      if (!query) return;
      const report = await reportsService.movements(req.user.id, query);
      return paginated(res, report.data, report.pagination);
    } catch (error) {
      next(error);
    }
  }

  async sales(req, res, next) {
    try {
      const query = check(salesQuerySchema, req, res);
      if (!query) return;
      const report = await reportsService.sales(req.user.id, query);
      return success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async salesByEmployee(req, res, next) {
    try {
      const query = check(salesByEmployeeQuerySchema, req, res);
      if (!query) return;
      const report = await reportsService.salesByEmployee(req.user.id, query);
      return success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async cancelledSales(req, res, next) {
    try {
      const query = check(cancelledSalesQuerySchema, req, res);
      if (!query) return;
      const report = await reportsService.cancelledSales(req.user.id, query);
      return success(res, report);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { reportsController: new ReportsController() };
