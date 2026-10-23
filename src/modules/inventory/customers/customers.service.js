'use strict';

const { HttpError, RECORD_STATUS } = require('nemkit');
const Sale = require('../sales/sales.model');
const { ContactService } = require('../contacts/contact.service');
const { CustomersRepository } = require('./customers.repository');
const { pagination, positiveInteger, escapeRegex } = require('../validation');

class CustomersService extends ContactService {
  constructor() {
    super(new CustomersRepository(), Sale, 'customerId', 'Customer');
  }

  update(id, data, userId) {
    return super.update(id, data, userId, ['name', 'document', 'phone', 'email', 'address', 'birthDate']);
  }

  /**
   * Búsqueda rápida de cliente por celular o documento (identificación en
   * mostrador). Disponible para cualquier empleado del tenant. Coincidencia
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

  /**
   * Perfil 360° del cliente: datos + métricas + historial de compras paginado.
   */
  async profile(id, userId, query = {}) {
    const customer = await this.getOwned(id, userId);
    const { page, limit } = pagination(query);
    const customerId = positiveInteger(id, 'customerId');

    const filter = { userId, customerId, recordStatus: RECORD_STATUS.ACTIVE };

    const [sales, total] = await Promise.all([
      Sale.find(filter)
        .select('_id date total items employeeSnapshot')
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Sale.countDocuments(filter),
    ]);

    return {
      customer,
      history: {
        data: sales.map(({ _id, ...sale }) => ({ id: _id, ...sale })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }
}

module.exports = { customersService: new CustomersService() };
