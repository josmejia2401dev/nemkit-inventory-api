'use strict';

const { HttpError, RECORD_STATUS } = require('nemkit');
const { ContactService } = require('../contacts/contact.service');
const { CustomersRepository } = require('./customers.repository');
const { pagination, positiveInteger, escapeRegex } = require('../validation');
const { resolveLoyaltyTier } = require('../inventory.constants');

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
    const salesService = this.#salesService();
    const [history, analytics] = await Promise.all([
      salesService.listCustomerHistory(
        userId,
        customerId,
        { page, limit },
      ),
      salesService.customerAnalytics(userId, customerId),
    ]);

    return {
      customer,
      analytics,
      history: {
        data: history.sales,
        pagination: {
          page,
          limit,
          total: history.total,
          totalPages: Math.ceil(history.total / limit),
        },
      },
    };
  }

  getActiveForDocument(id, userId, session = null) {
    const customerId = positiveInteger(id, 'customerId');
    return this.repository.findActiveForDocument(customerId, userId, session);
  }

  dashboardMetrics(userId, since) {
    return this.repository.dashboardMetrics(userId, since);
  }

  async recordSale(customer, total, date, userId, session = null) {
    const previousSpent = customer.stats?.totalSpent ?? 0;
    const previousCount = customer.stats?.purchaseCount ?? 0;
    const newSpent = this.#roundMoney(previousSpent + total);
    const newCount = previousCount + 1;

    return this.repository.updateSaleStats(customer._id, userId, {
      'stats.totalSpent': newSpent,
      'stats.purchaseCount': newCount,
      'stats.firstPurchaseAt': customer.stats?.firstPurchaseAt ?? date,
      'stats.lastPurchaseAt': date,
      loyaltyTier: resolveLoyaltyTier(newSpent, newCount),
    }, session);
  }

  async reverseSale(customerId, total, userId, session = null) {
    const customer = await this.getActiveForDocument(customerId, userId, session);
    if (!customer) return false;

    const newSpent = Math.max(0, this.#roundMoney((customer.stats?.totalSpent ?? 0) - total));
    const newCount = Math.max(0, (customer.stats?.purchaseCount ?? 0) - 1);

    await this.repository.updateSaleStats(customer._id, userId, {
      'stats.totalSpent': newSpent,
      'stats.purchaseCount': newCount,
      loyaltyTier: resolveLoyaltyTier(newSpent, newCount),
    }, session);

    return true;
  }

  #roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

module.exports = { customersService: new CustomersService() };
