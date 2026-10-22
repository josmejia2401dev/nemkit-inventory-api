'use strict';

const Purchase = require('./purchases.model');
const Supplier = require('../suppliers/suppliers.model');
const { InventoryDocumentService } = require('../documents/document.service');
const { MOVEMENT_TYPE, MOVEMENT_DIRECTION } = require('../inventory.constants');

class PurchasesService extends InventoryDocumentService {
  constructor() {
    super({
      model: Purchase,
      contactModel: Supplier,
      contactField: 'supplierId',
      movementType: MOVEMENT_TYPE.PURCHASE,
      direction: MOVEMENT_DIRECTION.IN,
      amountField: 'unitCost',
      label: 'Purchase',
      requiredContact: true,
    });
  }
}

module.exports = { purchasesService: new PurchasesService() };
