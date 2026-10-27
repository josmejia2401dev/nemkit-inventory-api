'use strict';

const { BaseService, HttpError, RECORD_STATUS } = require('nemkit');
const { DeliveriesRepository } = require('./deliveries.repository');
const { employeesService } = require('../../foundation/employees/employees.service');
const { pagination, positiveInteger } = require('../validation');
const {
  DELIVERY_STATUS,
  DELIVERY_STATUSES,
  DELIVERY_TRANSITIONS,
} = require('../inventory.constants');

class DeliveriesService extends BaseService {
  constructor() {
    super(new DeliveriesRepository());
    this.notFoundMessage = 'Delivery not found';
    this.salesOperations = null;
  }

  setSalesOperations({ voidSale, setOrderStatusFromDelivery }) {
    if (typeof voidSale !== 'function' || typeof setOrderStatusFromDelivery !== 'function') {
      throw new TypeError('Delivery sales operations must provide voidSale and setOrderStatusFromDelivery');
    }
    this.salesOperations = { voidSale, setOrderStatusFromDelivery };
  }

  #getSalesOperations() {
    if (!this.salesOperations) {
      throw new Error('Delivery sales operations have not been configured');
    }
    return this.salesOperations;
  }

  /**
   * @param {number} userId - empresa
   * @param {Object} query - filtros (status, courierId, customerId)
   * @param {Object} [ctx] - contexto de acceso
   * @param {number} [ctx.restrictToCourierId] - si viene, limita a los domicilios
   *   de ese domiciliario (lo usa el rol COURIER para ver solo los suyos).
   */
  async list(userId, query = {}, ctx = {}) {
    const { page, limit } = pagination(query);
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };

    if (query.status !== undefined) {
      if (!DELIVERY_STATUSES.includes(query.status)) {
        throw HttpError.badRequest(`status must be one of: ${DELIVERY_STATUSES.join(', ')}`);
      }
      filter.status = query.status === DELIVERY_STATUS.ON_ROUTE
        ? { $in: [DELIVERY_STATUS.ON_ROUTE, 'picked_up'] }
        : query.status;
    }
    if (ctx.restrictToCourierId != null) {
      filter.courierId = positiveInteger(ctx.restrictToCourierId, 'courierId');
    } else if (query.courierId !== undefined) {
      filter.courierId = positiveInteger(query.courierId, 'courierId');
    }
    if (query.customerId !== undefined) {
      filter.customerId = positiveInteger(query.customerId, 'customerId');
    }

    const result = await this.filterAndPaginate(filter, { page, limit, sort: { createdAt: -1 } });
    return {
      ...result,
      data: result.data.map((delivery) => delivery.status === 'picked_up'
        ? { ...delivery, status: DELIVERY_STATUS.ON_ROUTE }
        : delivery),
    };
  }

  async summariesBySaleIds(userId, saleIds) {
    if (!saleIds.length) return [];
    return this.repository.findSaleSummaries(userId, saleIds);
  }

  async getOwned(id, userId, ctx = {}) {
    const deliveryId = positiveInteger(id, 'deliveryId');
    const filter = {
      _id: deliveryId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    };
    if (ctx.restrictToCourierId != null) {
      filter.courierId = positiveInteger(ctx.restrictToCourierId, 'courierId');
    }
    const delivery = await this.findOne(filter);
    if (!delivery) throw HttpError.notFound('Delivery not found');
    return delivery;
  }

  async assignCourier(id, courierId, userId) {
    await this.getOwned(id, userId);
    const courier = await this.#resolveCourier(userId, courierId, { required: true });
    return this.updateById(id, {
      courierId: courier.courierId,
      courierSnapshot: courier.courierSnapshot,
    }, userId);
  }

  async changeStatus(id, nextStatus, userId, ctx = {}) {
    if (!DELIVERY_STATUSES.includes(nextStatus)) {
      throw HttpError.badRequest(`status must be one of: ${DELIVERY_STATUSES.join(', ')}`);
    }
    const delivery = await this.getOwned(id, userId, ctx);
    const currentStatus = delivery.status === 'picked_up'
      ? DELIVERY_STATUS.ON_ROUTE
      : delivery.status;
    const allowed = [...(DELIVERY_TRANSITIONS[currentStatus] ?? [])];
    if (!allowed.includes(nextStatus)) {
      throw HttpError.conflict(`Cannot change status from ${currentStatus} to ${nextStatus}`);
    }

    if (nextStatus === DELIVERY_STATUS.CANCELLED && delivery.saleId != null) {
      const { voidSale } = this.#getSalesOperations();
      await voidSale(delivery.saleId, userId);
      return this.getOwned(id, userId, ctx);
    }
    // Salir a ruta requiere un domiciliario asignado; ese paso implica que ya
    // recogió el pedido, así se evita un estado intermedio duplicado.
    if (nextStatus === DELIVERY_STATUS.ON_ROUTE && delivery.courierId == null) {
      throw HttpError.badRequest('Assign a courier before sending the delivery on route');
    }

    const update = { status: nextStatus };
    const now = new Date();
    if (nextStatus === DELIVERY_STATUS.ON_ROUTE) update['timeline.dispatchedAt'] = now;
    if (nextStatus === DELIVERY_STATUS.DELIVERED) update['timeline.deliveredAt'] = now;
    if (nextStatus === DELIVERY_STATUS.CANCELLED) update['timeline.cancelledAt'] = now;

    return this.repository.withTransaction(async (session) => {
      const updatedDelivery = await this.repository.changeStatusInSession(
        id,
        userId,
        delivery.status,
        update,
        session,
      );
      if (!updatedDelivery) throw HttpError.conflict('Delivery status changed; refresh and try again');
      if (delivery.saleId != null) {
        const { setOrderStatusFromDelivery } = this.#getSalesOperations();
        await setOrderStatusFromDelivery(delivery.saleId, userId, nextStatus, session);
      }
      return updatedDelivery;
    });
  }

  syncFromKitchen(saleId, userId, kitchenStatus, session) {
    return this.repository.syncFromKitchen(saleId, userId, kitchenStatus, session);
  }

  cancelBySale(saleId, userId, session) {
    return this.repository.cancelBySale(saleId, userId, session);
  }

  existsForSale(saleId, userId) {
    return this.repository.existsForSale(saleId, userId);
  }

  createFromSale(data, session) {
    return this.repository.createFromSale(data, session);
  }

  async dashboardMetrics(userId) {
    const { byStatus, averageMinutes } = await this.repository.dashboardMetrics(userId);
    const counts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));

    return {
      pending: counts[DELIVERY_STATUS.PENDING] || 0,
      preparing: counts[DELIVERY_STATUS.PREPARING] || 0,
      onRoute: counts[DELIVERY_STATUS.ON_ROUTE] || 0,
      delivered: counts[DELIVERY_STATUS.DELIVERED] || 0,
      cancelled: counts[DELIVERY_STATUS.CANCELLED] || 0,
      avgDeliveryMinutes: averageMinutes != null ? Math.round(averageMinutes) : null,
    };
  }

  /**
   * Anula una entrega ya realizada (el cliente no estaba, no se recibió, etc.):
   * reversa la venta asociada (repone stock, registra movimiento de reversa,
   * revierte métricas del cliente) y marca el domicilio como cancelado.
   */
  async voidDelivery(id, userId, { reason = '', restrictToCourierId } = {}) {
    const delivery = await this.getOwned(id, userId, { restrictToCourierId });
    if (delivery.status !== DELIVERY_STATUS.DELIVERED) {
      throw HttpError.conflict('Only a delivered order can be voided');
    }
    if (delivery.saleId != null) {
      const { voidSale } = this.#getSalesOperations();
      await voidSale(delivery.saleId, userId, { reason });
      return this.getOwned(id, userId, { restrictToCourierId });
    }
    return this.updateById(id, {
      status: DELIVERY_STATUS.CANCELLED,
      'timeline.cancelledAt': new Date(),
    }, userId);
  }

  async setProof(id, proof, userId, ctx = {}) {
    const delivery = await this.getOwned(id, userId, ctx);
    if (delivery.status !== DELIVERY_STATUS.DELIVERED) {
      throw HttpError.badRequest('Proof can only be attached to a delivered order');
    }
    return this.updateById(id, { proof }, userId);
  }

  async #resolveCourier(userId, courierId, { required = false } = {}) {
    if (courierId == null || courierId === '') {
      if (required) throw HttpError.badRequest('courierId is required');
      return { courierId: null, courierSnapshot: { name: '' } };
    }
    return employeesService.getActiveCourierSnapshot(userId, courierId);
  }

}

module.exports = { DeliveriesService, deliveriesService: new DeliveriesService() };
