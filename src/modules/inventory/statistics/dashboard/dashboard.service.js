'use strict';

const { DashboardRepository } = require('./dashboard.repository');
const models = require('../statistics.models');

class DashboardService {
  constructor(repository = new DashboardRepository(models)) {
    this.repository = repository;
  }

  dashboardSummary(userId) {
    return this.repository.dashboard(userId, new Date(Date.now() - 30 * 86400000));
  }

  stockAlerts(userId) {
    return this.repository.stockAlerts(userId);
  }
}

module.exports = { DashboardService, dashboardService: new DashboardService() };
