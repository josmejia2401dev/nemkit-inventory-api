'use strict';

const Sale = require('./sales.model');
const Customer = require('../customers/customers.model');
const { InventoryDocumentService } = require('../documents/document.service');
const { MOVEMENT_TYPE, MOVEMENT_DIRECTION } = require('../inventory.constants');

class SalesService extends InventoryDocumentService {
  constructor() {
    super({
      model: Sale,
      contactModel: Customer,
      contactField: 'customerId',
      movementType: MOVEMENT_TYPE.SALE,
      direction: MOVEMENT_DIRECTION.OUT,
      amountField: 'unitPrice',
      label: 'Sale',
      requiredContact: true,
    });
  }
}

module.exports = { salesService: new SalesService() };
