'use strict';

const logger = require('./logger');
const { foundation } = require('./foundation');

/**
 * Sincroniza los índices de foundation + dominio. Idempotente.
 */
async function syncIndexes() {
  const models = [
    ...Object.values(foundation.models),
    require('../modules/inventory/products/products.model'),
    require('../modules/inventory/categories/categories.model'),
    require('../modules/inventory/customers/customers.model'),
    require('../modules/inventory/suppliers/suppliers.model'),
    require('../modules/inventory/movements/movements.model'),
    require('../modules/inventory/purchases/purchases.model'),
    require('../modules/inventory/sales/sales.model'),
    require('../modules/inventory/deliveries/deliveries.model'),
    require('../modules/inventory/cash-withdrawals/cash-withdrawals.model'),
    require('../modules/inventory/layaways/layaways.model'),
    require('../modules/inventory/layaways/layaway-payments.model'),
    require('../modules/inventory/layaways/layaway-settings.model'),
  ];

  for (const model of models) {
    try {
      await model.syncIndexes();
    } catch (error) {
      logger.warn(`Index sync failed for ${model.modelName}.`, { error: error.message });
    }
  }
}

module.exports = { syncIndexes };
