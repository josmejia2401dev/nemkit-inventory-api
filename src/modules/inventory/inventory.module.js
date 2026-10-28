'use strict';

const { deliveriesService } = require('./deliveries/deliveries.service');
const { salesService } = require('./sales/sales.service');
const { statisticsService } = require('./statistics/statistics.service');

deliveriesService.setSalesOperations({
  voidSale: (...args) => salesService.voidSale(...args),
  setOrderStatusFromDelivery: (...args) => salesService.setOrderStatusFromDelivery(...args),
});

salesService.setStatisticsOperations({
  recordCustomerPurchase: (...args) => statisticsService.recordCustomerPurchase(...args),
  reverseCustomerPurchase: (...args) => statisticsService.reverseCustomerPurchase(...args),
});

module.exports = { deliveriesService, salesService };
