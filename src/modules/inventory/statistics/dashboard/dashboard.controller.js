'use strict';

const { success } = require('nemkit');
const { dashboardService } = require('./dashboard.service');

class DashboardController {
  async dashboardSummary(req, res, next) {
    try {
      return success(res, await dashboardService.dashboardSummary(req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async stockAlerts(req, res, next) {
    try {
      return success(res, await dashboardService.stockAlerts(req.user.id));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { dashboardController: new DashboardController() };
