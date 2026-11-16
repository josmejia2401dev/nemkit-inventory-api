'use strict';

const { RECORD_STATUS } = require('nemkit');
const { limitsService } = require('../foundation/limits/limits.service');
const { deliveriesService } = require('./deliveries/deliveries.service');
const { salesService } = require('./sales/sales.service');
const { statisticsService } = require('./statistics/statistics.service');
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
  setOrderStatusFromDelivery: (...args) => salesService.setOrderStatusFromDelivery(...args),
});

salesService.setStatisticsOperations({
  recordCustomerPurchase: (...args) => statisticsService.recordCustomerPurchase(...args),
  reverseCustomerPurchase: (...args) => statisticsService.reverseCustomerPurchase(...args),
});

module.exports = { deliveriesService, salesService };
