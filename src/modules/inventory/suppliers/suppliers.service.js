'use strict';

const { ContactService } = require('../contacts/contacts.service');
const { SuppliersRepository } = require('./suppliers.repository');

class SuppliersService extends ContactService {
  constructor() {
    super(
      new SuppliersRepository(),
      (userId, supplierId) => require('../purchases/purchases.service').purchasesService
        .hasSupplierPurchases(userId, supplierId),
      'Supplier',
    );
  }

  update(id, data, userId) {
    return super.update(id, data, userId, ['name', 'document', 'phone', 'email', 'address']);
  }

  getActiveForDocument(id, userId, session = null) {
    return this.repository.findActiveForDocument(id, userId, session);
  }
}

module.exports = { suppliersService: new SuppliersService() };
