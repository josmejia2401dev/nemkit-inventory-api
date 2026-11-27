'use strict';

// Composition boundary for read-only analytics. Statistics owns its queries and
// only receives model handles here; operational modules never import this file.
module.exports = {
  Product: require('../products/products.model'),
  Category: require('../categories/categories.model'),
  Movement: require('../movements/movements.model'),
  Customer: require('../customers/customers.model'),
  Sale: require('../sales/sales.model'),
  Layaway: require('../layaways/layaways.model'),
  LayawayPayment: require('../layaways/layaway-payments.model'),
  Delivery: require('../deliveries/deliveries.model'),
  Purchase: require('../purchases/purchases.model'),
  CashWithdrawal: require('../cash-withdrawals/cash-withdrawals.model'),
};
