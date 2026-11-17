'use strict';

const { HttpError } = require('nemkit');
const { SalesRepository } = require('../sales/sales.repository');
const { salesService } = require('../sales/sales.service');
const { deliveriesService } = require('../deliveries/deliveries.service');
const { positiveInteger } = require('../validation');
const { ORDER_STATUS, ORDER_STATUSES, DOCUMENT_STATUS } = require('../inventory.constants');
const { nextStatusesFor, allowedRoles, timelineFor } = require('./order-progress');

/**
 * Ciclo de vida de la comanda: consulta, avance de preparación y anulación.
 * Vive aquí y no en ventas; la venta solo registra y cobra el documento.
 */
class KitchenService {
  constructor({
    repository = new SalesRepository(),
    cancelSale = (...args) => salesService.voidSale(...args),
  } = {}) {
    this.repository = repository;
    this.cancelSale = cancelSale;
  }

  list(userId, { includeCompleted = false } = {}) {
    return this.repository.listKitchenOrders(userId, includeCompleted);
  }

  activeCountsByTable(userId) {
    return this.repository.activeKitchenOrderCountsByTable(userId);
  }

  async changeStatus(saleId, status, userId, businessType, roles) {
    const id = positiveInteger(saleId, 'saleId');
    if (!ORDER_STATUSES.includes(status)) {
      throw HttpError.badRequest(`orderStatus must be one of: ${ORDER_STATUSES.join(', ')}`);
    }
    if (![ORDER_STATUS.PREPARING, ORDER_STATUS.READY, ORDER_STATUS.DELIVERED].includes(status)) {
      throw HttpError.badRequest('Preparation can only advance an order to preparing, ready, or delivered');
    }
    return this.advanceOrder(id, userId, status, businessType, roles);
  }

  async advanceOrder(saleId, userId, nextStatus, businessType, roles = []) {
    const id = positiveInteger(saleId, 'saleId');
    const sale = await this.repository.findKitchenSale(id, userId);
    if (!sale) throw HttpError.notFound('Sale not found');
    if (sale.status === DOCUMENT_STATUS.VOID) throw HttpError.conflict('Sale is void');
    if (businessType !== 'restaurant' && sale.orderChannel === 'delivery') {
      throw HttpError.conflict('Manage delivery order progress from Domicilios');
    }

    const currentStatus = sale.orderStatus ?? sale.kitchenStatus ?? ORDER_STATUS.PENDING;
    if (!nextStatusesFor(currentStatus, sale.orderChannel).includes(nextStatus)) {
      throw HttpError.conflict(`Cannot change order status from ${currentStatus} to ${nextStatus}`);
    }

    if (!roles.some((role) => allowedRoles(businessType).includes(role))) {
      throw HttpError.forbidden('Your role cannot advance this order');
    }
    if ((businessType === 'restaurant') !== (sale.kitchenStatus != null)) {
      throw HttpError.conflict('This order belongs to a different preparation workflow');
    }

    const timeline = timelineFor(nextStatus);

    return this.repository.withTransaction(async (session) => {
      const result = await this.repository.setOrderProgressInSession(
        id,
        userId,
        currentStatus,
        nextStatus,
        timeline,
        session,
      );
      if (result.matchedCount !== 1) {
        throw HttpError.conflict('Order status changed; refresh and try again');
      }
      await deliveriesService.syncFromKitchen(id, userId, nextStatus, session);
      return { id, orderStatus: nextStatus };
    });
  }

  /** Refleja en la venta el estado que reporta el módulo de domicilios. */
  async setOrderStatusFromDelivery(saleId, userId, status, session) {
    const result = await this.repository.setOrderStatusInSession(
      positiveInteger(saleId, 'saleId'),
      userId,
      status,
      session,
    );
    if (result.matchedCount !== 1) throw HttpError.conflict('The sale linked to this delivery no longer exists');
    return result;
  }

  cancel(saleId, userId, options) {
    return this.cancelSale(saleId, userId, options);
  }
}

module.exports = { KitchenService, kitchenService: new KitchenService() };
