'use strict';

const logger = require('./logger');

/**
 * Sincroniza los índices declarados en los esquemas con la base de datos.
 * Idempotente. Si una colección tiene datos que violan un índice único nuevo
 * (p. ej. emails duplicados preexistentes), la sincronización de ese modelo
 * falla con un aviso claro, sin tumbar el arranque del servidor.
 */
async function syncIndexes() {
  const models = [
    require('../modules/foundation/users/users.model'),
    require('../modules/foundation/tokens/tokens.model'),
    require('../modules/inventory/products/products.model'),
    require('../modules/inventory/categories/categories.model'),
    require('../modules/inventory/customers/customers.model'),
    require('../modules/inventory/suppliers/suppliers.model'),
    require('../modules/inventory/employees/employees.model'),
    require('../modules/inventory/movements/movements.model'),
    require('../modules/inventory/purchases/purchases.model'),
    require('../modules/inventory/sales/sales.model'),
    require('../modules/inventory/deliveries/deliveries.model'),
    require('../modules/inventory/tables/tables.model'),
    require('../modules/foundation/feedback/feedback.model'),
  ];

  for (const model of models) {
    try {
      await model.syncIndexes();
    } catch (error) {
      logger.warn(`Index sync failed for ${model.modelName}. Check for data that violates a unique index (e.g. duplicate emails).`, {
        error: error.message,
      });
    }
  }
}

module.exports = { syncIndexes };
