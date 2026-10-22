'use strict';

const Purchase = require('../purchases/purchases.model');
const { ContactService } = require('../contacts/contact.service');
const { SuppliersRepository } = require('./suppliers.repository');

class SuppliersService extends ContactService {
  constructor() {
    super(new SuppliersRepository(), Purchase, 'supplierId', 'Supplier');
  }

  update(id, data, userId) {
    return super.update(id, data, userId, ['name', 'document', 'phone', 'email', 'address']);
  }
}

module.exports = { suppliersService: new SuppliersService() };
