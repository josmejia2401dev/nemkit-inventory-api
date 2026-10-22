'use strict';

const Sale = require('../sales/sales.model');
const { ContactService } = require('../contacts/contact.service');
const { CustomersRepository } = require('./customers.repository');

class CustomersService extends ContactService {
  constructor() {
    super(new CustomersRepository(), Sale, 'customerId', 'Customer');
  }

  update(id, data, userId) {
    return super.update(id, data, userId, ['name', 'document', 'phone', 'email']);
  }
}

module.exports = { customersService: new CustomersService() };
