'use strict';

const { productsService } = require('../products/products.service');
const { movementsService } = require('../movements/movements.service');
const { customersService } = require('../customers/customers.service');
const { salesService } = require('../sales/sales.service');
const { deliveriesService } = require('../deliveries/deliveries.service');

class DashboardService {
  stockAlertDetails(userId) {
    return productsService.stockAlertDetails(userId);
  }

  customerMetrics(userId, since) {
    return customersService.dashboardMetrics(userId, since);
  }

  employeeSales(userId, since) {
    return salesService.dashboardEmployeeSales(userId, since);
  }

  deliveryMetrics(userId) {
    return deliveriesService.dashboardMetrics(userId);
  }

  async summary(userId) {
    const monthAgo = new Date(Date.now() - 30 * 86400000);
    const [products, recentMovements, topSellingProducts, customers, topEmployees, deliveries] = await Promise.all([
      productsService.dashboardSummary(userId),
      movementsService.dashboardRecent(userId),
      movementsService.dashboardTopSellingProducts(userId, monthAgo),
      this.customerMetrics(userId, monthAgo),
      this.employeeSales(userId, monthAgo),
      this.deliveryMetrics(userId),
    ]);

    return {
      totalProducts: products.totalProducts,
      outOfStock: products.outOfStock,
      lowStock: products.lowStock,
      inventoryValue: products.inventoryValue,
      recentMovements,
      topSellingProducts,
      customers,
      topEmployees,
      deliveries,
    };
  }
}

module.exports = { dashboardService: new DashboardService() };
