'use strict';

const { RECORD_STATUS } = require('nemkit');
const { limitsService } = require('../foundation/limits/limits.service');
const { deliveriesService } = require('./deliveries/deliveries.service');
const { salesService } = require('./sales/sales.service');
const { kitchenService } = require('./kitchen/kitchen.service');
const { loyaltyService } = require('./statistics/loyalty/loyalty.service');
const Product = require('./products/products.model');
const Customer = require('./customers/customers.model');
const Supplier = require('./suppliers/suppliers.model');

const ACTIVE_FILTER = Object.freeze({ recordStatus: RECORD_STATUS.ACTIVE });

// `foundation` no importa modelos de negocio: el dominio le registra cómo
// contar sus límites con periodo `total` al componerse la aplicación.
limitsService.registerTotalCounter(
  'products',
  (userId) => Product.countDocuments({ userId, ...ACTIVE_FILTER }),
);
limitsService.registerTotalCounter('contacts', async (userId) => {
  const [customers, suppliers] = await Promise.all([
    Customer.countDocuments({ userId, ...ACTIVE_FILTER }),
    Supplier.countDocuments({ userId, ...ACTIVE_FILTER }),
  ]);
  return customers + suppliers;
});

deliveriesService.setSalesOperations({
  voidSale: (...args) => salesService.voidSale(...args),
  setOrderStatusFromDelivery: (...args) => kitchenService.setOrderStatusFromDelivery(...args),
});

salesService.setStatisticsOperations({
  recordCustomerPurchase: (...args) => loyaltyService.recordCustomerPurchase(...args),
  reverseCustomerPurchase: (...args) => loyaltyService.reverseCustomerPurchase(...args),
});

module.exports = { deliveriesService, salesService };
