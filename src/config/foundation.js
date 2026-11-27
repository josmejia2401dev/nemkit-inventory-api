'use strict';

const { createFoundation } = require('nemkit');
const { env } = require('./env');
const logger = require('./logger');
const { PLANS } = require('./plans');
const { sendEmail } = require('./otp-notifier');

const notifier = env.NOTIFY_API_URL && env.NOTIFY_API_KEY ? { sendEmail } : null;

let foundation;

foundation = createFoundation({
  env,
  logger,
  plans: PLANS,
  productName: 'Nemkit Inventory',
  emailVerification: true,
  notifier,
  // Retail: sin meseros, cocineros ni bodega dedicada.
  roles: ['SUPERADMIN', 'ADMIN', 'USER', 'CASHIER', 'SELLER', 'COURIER'],
  counters: {
    employees: (userId) => foundation.models.Employee.countDocuments({
      userId,
      recordStatus: 'active',
      status: 'active',
    }),
    products: (userId) => require('../modules/inventory/products/products.model')
      .countDocuments({ userId, recordStatus: 'active' }),
    contacts: async (userId) => {
      const Customer = require('../modules/inventory/customers/customers.model');
      const Supplier = require('../modules/inventory/suppliers/suppliers.model');
      const filter = { userId, recordStatus: 'active' };
      const [customers, suppliers] = await Promise.all([
        Customer.countDocuments(filter),
        Supplier.countDocuments(filter),
      ]);
      return customers + suppliers;
    },
  },
});

module.exports = { foundation };
