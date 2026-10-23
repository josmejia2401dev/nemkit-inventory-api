'use strict';

const { success, paginated } = require('nemkit');
const { reportsService } = require('./reports.service');

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
      const report = await reportsService.movements(req.user.id, req.query);
      return paginated(res, report.data, report.pagination);
    } catch (error) {
      next(error);
    }
  }

  async sales(req, res, next) {
    try {
      const report = await reportsService.sales(req.user.id, req.query);
      return success(res, report);
    } catch (error) {
      next(error);
    }
  }

  async salesByEmployee(req, res, next) {
    try {
      const report = await reportsService.salesByEmployee(req.user.id, req.query);
      return success(res, report);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { reportsController: new ReportsController() };
