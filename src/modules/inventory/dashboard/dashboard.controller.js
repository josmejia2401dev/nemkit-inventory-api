'use strict';

const { success } = require('nemkit');
const { dashboardService } = require('./dashboard.service');

class DashboardController {
  async alerts(req, res, next) {
    try {
      const alerts = await dashboardService.stockAlertDetails(req.user.id);
      return success(res, alerts);
    } catch (error) {
      next(error);
    }
  }

  async summary(req, res, next) {
    try {
      const summary = await dashboardService.summary(req.user.id);
      return success(res, summary);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { dashboardController: new DashboardController() };
