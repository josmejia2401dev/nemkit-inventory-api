'use strict';

const { success, paginated } = require('nemkit');
const { statisticsService } = require('./statistics.service');
const {
  customerProfileQuerySchema,
  paymentSummaryQuerySchema,
  movementsQuerySchema,
  salesQuerySchema,
  salesByEmployeeQuerySchema,
  cancelledSalesQuerySchema,
} = require('./statistics.validator');

function check(schema, req, res) {
  const result = schema.check(req.query ?? {}, req);
  if (result.errorResponse) {
    res.status(400).json(result.errorResponse);
    return null;
  }
  return result.sanitized;
}

class StatisticsController {
  async dashboardSummary(req, res, next) {
    try {
      return success(res, await statisticsService.dashboardSummary(req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async stockAlerts(req, res, next) {
    try {
      return success(res, await statisticsService.stockAlerts(req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async customerProfile(req, res, next) {
    try {
      const query = check(customerProfileQuerySchema, req, res);
      if (!query) return;
      return success(res, await statisticsService.customerProfile(req.params.id, req.user.id, query));
    } catch (error) {
      next(error);
    }
  }

  async customerLoyaltyRules(req, res, next) {
    try {
      return success(res, statisticsService.customerLoyaltyRules());
    } catch (error) {
      next(error);
    }
  }

  async employeePaymentSummary(req, res, next) {
    try {
      const query = check(paymentSummaryQuerySchema, req, res);
      if (!query) return;
      return success(res, await statisticsService.employeePaymentsSummary(req.user.id, query));
    } catch (error) {
      next(error);
    }
  }

  async inventoryReport(req, res, next) {
    try {
      return success(res, await statisticsService.inventoryReport(req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async movementsReport(req, res, next) {
    try {
      const query = check(movementsQuerySchema, req, res);
      if (!query) return;
      const report = await statisticsService.movementsReport(req.user.id, query);
      return paginated(res, report.data, report.pagination);
    } catch (error) {
      next(error);
    }
  }

  async salesReport(req, res, next) {
    try {
      const query = check(salesQuerySchema, req, res);
      if (!query) return;
      return success(res, await statisticsService.salesReport(req.user.id, query));
    } catch (error) {
      next(error);
    }
  }

  async salesByEmployee(req, res, next) {
    try {
      const query = check(salesByEmployeeQuerySchema, req, res);
      if (!query) return;
      return success(res, await statisticsService.salesByEmployee(req.user.id, query));
    } catch (error) {
      next(error);
    }
  }

  async cancelledSales(req, res, next) {
    try {
      const query = check(cancelledSalesQuerySchema, req, res);
      if (!query) return;
      return success(res, await statisticsService.cancelledSales(req.user.id, query));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { statisticsController: new StatisticsController() };
