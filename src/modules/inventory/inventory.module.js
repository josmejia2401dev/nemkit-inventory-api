'use strict';

const { deliveriesService } = require('./deliveries/deliveries.service');
const { salesService } = require('./sales/sales.service');
const { loyaltyService } = require('./statistics/loyalty/loyalty.service');

// Retail: el domicilio actualiza directamente el estado de la venta; no hay cocina.
deliveriesService.setSalesOperations({
  voidSale: (...args) => salesService.voidSale(...args),
  setOrderStatusFromDelivery: (...args) => salesService.setOrderStatusFromDelivery(...args),
});

salesService.setStatisticsOperations({
  recordCustomerPurchase: (...args) => loyaltyService.recordCustomerPurchase(...args),
  reverseCustomerPurchase: (...args) => loyaltyService.reverseCustomerPurchase(...args),
});

module.exports = { deliveriesService, salesService };
