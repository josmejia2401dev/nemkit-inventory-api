'use strict';

const { deliveriesService } = require('./deliveries/deliveries.service');
const { salesService } = require('./sales/sales.service');

deliveriesService.setSalesOperations({
  voidSale: (...args) => salesService.voidSale(...args),
  setOrderStatusFromDelivery: (...args) => salesService.setOrderStatusFromDelivery(...args),
});

module.exports = { deliveriesService, salesService };
