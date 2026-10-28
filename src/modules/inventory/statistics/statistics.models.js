'use strict';

// Composition boundary for read-only analytics. Statistics owns its queries and
// only receives model handles here; operational modules never import this file.
module.exports = {
  Product: require('../products/products.model'),
  Category: require('../categories/categories.model'),
  Movement: require('../movements/movements.model'),
  Customer: require('../customers/customers.model'),
  Sale: require('../sales/sales.model'),
  Delivery: require('../deliveries/deliveries.model'),
  EmployeePayment: require('../employee-payments/employee-payments.model'),
};
