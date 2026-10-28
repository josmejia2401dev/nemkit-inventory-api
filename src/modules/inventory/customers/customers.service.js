'use strict';

const { HttpError, RECORD_STATUS } = require('nemkit');
const { ContactService } = require('../contacts/contacts.service');
const { CustomersRepository } = require('./customers.repository');
const { positiveInteger, escapeRegex } = require('../validation');

class CustomersService extends ContactService {
  constructor() {
    super(
      new CustomersRepository(),
      (userId, customerId) => this.#salesService().hasCustomerSales(userId, customerId),
      'Customer',
    );
  }

  #salesService() {
    return require('../sales/sales.service').salesService;
  }

  update(id, data, userId) {
    return super.update(id, data, userId, ['name', 'document', 'phone', 'email', 'address', 'birthDate']);
  }

  /**
   * Búsqueda rápida de cliente por celular o documento (identificación en
   * mostrador). Disponible para cualquier empleado del empresa. Coincidencia
   * exacta por teléfono/documento y, si no hay, por prefijo.
   */
  async lookup(userId, term) {
    if (typeof term !== 'string' || !term.trim()) {
      throw HttpError.badRequest('term is required');
    }
    const value = term.trim();
    if (value.length > 40) throw HttpError.badRequest('term is too long');
    const escaped = escapeRegex(value);

    const baseFilter = { userId, recordStatus: RECORD_STATUS.ACTIVE };

    const exact = await this.findOne({
      ...baseFilter,
      $or: [{ phone: value }, { document: value }],
    });
    if (exact) return exact;

    const prefix = new RegExp(`^${escaped}`);
    return this.findOne({
      ...baseFilter,
      $or: [{ phone: prefix }, { document: prefix }],
    });
  }

  getActiveForDocument(id, userId, session = null) {
    const customerId = positiveInteger(id, 'customerId');
    return this.repository.findActiveForDocument(customerId, userId, session);
  }

}

module.exports = { customersService: new CustomersService() };
