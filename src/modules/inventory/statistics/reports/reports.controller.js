'use strict';

const { success, paginated } = require('nemkit');
const { reportsService } = require('./reports.service');
const {
  paymentSummaryQuerySchema,
  movementsQuerySchema,
  salesQuerySchema,
  salesByEmployeeQuerySchema,
  cancelledSalesQuerySchema,
  cashFlowQuerySchema,
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
  async inventoryReport(req, res, next) {
    try {
      return success(res, await reportsService.inventoryReport(req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async movementsReport(req, res, next) {
    try {
      const query = check(movementsQuerySchema, req, res);
      if (!query) return;
      const report = await reportsService.movementsReport(req.user.id, query);
      return paginated(res, report.data, report.pagination);
    } catch (error) {
      next(error);
    }
  }

  async salesReport(req, res, next) {
    try {
      const query = check(salesQuerySchema, req, res);
      if (!query) return;
      return success(res, await reportsService.salesReport(req.user.id, query));
    } catch (error) {
      next(error);
    }
  }

  async salesByEmployee(req, res, next) {
    try {
      const query = check(salesByEmployeeQuerySchema, req, res);
      if (!query) return;
      return success(res, await reportsService.salesByEmployee(req.user.id, query));
    } catch (error) {
      next(error);
    }
  }

  async cancelledSales(req, res, next) {
    try {
      const query = check(cancelledSalesQuerySchema, req, res);
      if (!query) return;
      return success(res, await reportsService.cancelledSales(req.user.id, query));
    } catch (error) {
      next(error);
    }
  }

  async cashFlowReport(req, res, next) {
    try {
      const query = check(cashFlowQuerySchema, req, res);
      if (!query) return;
      return success(res, await reportsService.cashFlow(req.user.id, query));
    } catch (error) {
      next(error);
    }
  }

  async employeePaymentSummary(req, res, next) {
    try {
      const query = check(paymentSummaryQuerySchema, req, res);
      if (!query) return;
      return success(res, await reportsService.employeePaymentsSummary(req.user.id, query));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { reportsController: new ReportsController() };
