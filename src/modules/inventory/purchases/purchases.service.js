'use strict';

const { PurchasesRepository } = require('./purchases.repository');
const { InventoryDocumentService } = require('../documents/document.service');
const { suppliersService } = require('../suppliers/suppliers.service');
const { MOVEMENT_TYPE, MOVEMENT_DIRECTION } = require('../inventory.constants');

class PurchasesService extends InventoryDocumentService {
  constructor() {
    super({
      repository: new PurchasesRepository(),
      contactService: suppliersService,
      contactField: 'supplierId',
      movementType: MOVEMENT_TYPE.PURCHASE,
      direction: MOVEMENT_DIRECTION.IN,
      amountField: 'unitCost',
      label: 'Purchase',
      requiredContact: true,
    });
  }

  hasSupplierPurchases(userId, supplierId) {
    return this.repository.hasSupplierPurchases(userId, supplierId);
  }
}

module.exports = { purchasesService: new PurchasesService() };
