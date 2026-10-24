'use strict';

const { InventoryDocumentRepository } = require('../documents/document.repository');
const Purchase = require('./purchases.model');

class PurchasesRepository extends InventoryDocumentRepository {
  constructor() {
    super(Purchase);
  }

  hasSupplierPurchases(userId, supplierId) {
    return this._applyTimeout(this.model.exists({ userId, supplierId }));
  }
}

module.exports = { PurchasesRepository };
