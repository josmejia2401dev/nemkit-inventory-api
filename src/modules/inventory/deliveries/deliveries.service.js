'use strict';

const { BaseService, HttpError, RECORD_STATUS } = require('nemkit');
const { DeliveriesRepository } = require('./deliveries.repository');
const Employee = require('../employees/employees.model');
const { salesService } = require('../sales/sales.service');
const { pagination, positiveInteger } = require('../validation');
const {
  EMPLOYEE_ROLE,
  EMPLOYEE_STATUS,
  DELIVERY_STATUS,
  DELIVERY_STATUSES,
  DELIVERY_TRANSITIONS,
} = require('../inventory.constants');

class DeliveriesService extends BaseService {
  constructor() {
    super(new DeliveriesRepository());
    this.notFoundMessage = 'Delivery not found';
  }

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };

    if (query.status !== undefined) {
      if (!DELIVERY_STATUSES.includes(query.status)) {
        throw HttpError.badRequest(`status must be one of: ${DELIVERY_STATUSES.join(', ')}`);
      }
      filter.status = query.status;
    }
    if (query.courierId !== undefined) {
      filter.courierId = positiveInteger(query.courierId, 'courierId');
    }
    if (query.customerId !== undefined) {
      filter.customerId = positiveInteger(query.customerId, 'customerId');
    }

    return this.filterAndPaginate(filter, { page, limit, sort: { createdAt: -1 } });
  }

  async getOwned(id, userId) {
    const deliveryId = positiveInteger(id, 'deliveryId');
    const delivery = await this.findOne({
      _id: deliveryId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });
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

  async changeStatus(id, nextStatus, userId) {
    if (!DELIVERY_STATUSES.includes(nextStatus)) {
      throw HttpError.badRequest(`status must be one of: ${DELIVERY_STATUSES.join(', ')}`);
    }
    const delivery = await this.getOwned(id, userId);
    const allowed = DELIVERY_TRANSITIONS[delivery.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw HttpError.conflict(`Cannot change status from ${delivery.status} to ${nextStatus}`);
    }
    if (nextStatus === DELIVERY_STATUS.ON_ROUTE && delivery.courierId == null) {
      throw HttpError.badRequest('Assign a courier before dispatching the delivery');
    }

    const update = { status: nextStatus };
    const now = new Date();
    if (nextStatus === DELIVERY_STATUS.ON_ROUTE) update['timeline.dispatchedAt'] = now;
    if (nextStatus === DELIVERY_STATUS.DELIVERED) update['timeline.deliveredAt'] = now;
    if (nextStatus === DELIVERY_STATUS.CANCELLED) update['timeline.cancelledAt'] = now;

    // La venta ya existe (el domicilio nace de una venta). Entregar solo marca
    // el hito; el stock y el ingreso se registraron al crear la venta.
    return this.updateById(id, update, userId);
  }

  /**
   * Anula una entrega ya realizada (el cliente no estaba, no se recibió, etc.):
   * reversa la venta asociada (repone stock, registra movimiento de reversa,
   * revierte métricas del cliente) y marca el domicilio como cancelado.
   */
  async voidDelivery(id, userId, { reason = '' } = {}) {
    const delivery = await this.getOwned(id, userId);
    if (delivery.status !== DELIVERY_STATUS.DELIVERED) {
      throw HttpError.conflict('Only a delivered order can be voided');
    }
    if (delivery.saleId != null) {
      await salesService.voidSale(delivery.saleId, userId, { reason });
    }
    return this.updateById(id, {
      status: DELIVERY_STATUS.CANCELLED,
      'timeline.cancelledAt': new Date(),
    }, userId);
  }

  async setProof(id, proof, userId) {
    const delivery = await this.getOwned(id, userId);
    if (delivery.status !== DELIVERY_STATUS.DELIVERED) {
      throw HttpError.badRequest('Proof can only be attached to a delivered order');
    }
    const validated = this.#validateProof(proof);
    return this.updateById(id, { proof: validated }, userId);
  }

  async #resolveCourier(userId, courierId, { required = false } = {}) {
    if (courierId == null || courierId === '') {
      if (required) throw HttpError.badRequest('courierId is required');
      return { courierId: null, courierSnapshot: { name: '' } };
    }
    const id = positiveInteger(courierId, 'courierId');
    const employee = await Employee.findOne({
      _id: id,
      userId,
      role: EMPLOYEE_ROLE.COURIER,
      status: EMPLOYEE_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id name').lean();
    if (!employee) throw HttpError.badRequest('Invalid or inactive courier (must be an active employee with courier role)');
    return { courierId: employee._id, courierSnapshot: { name: employee.name } };
  }

  #validateProof(proof) {
    if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
      throw HttpError.badRequest('proof must be an object');
    }
    const allowed = new Set(['photo', 'signature', 'observation']);
    if (Object.keys(proof).some((key) => !allowed.has(key))) {
      throw HttpError.badRequest('proof contains unsupported fields');
    }
    const result = {};
    for (const field of ['photo', 'signature']) {
      if (proof[field] !== undefined) result[field] = this.#validateMedia(proof[field], field);
    }
    if (proof.observation !== undefined) {
      if (typeof proof.observation !== 'string' || proof.observation.length > 1000) {
        throw HttpError.badRequest('proof.observation must be a string of at most 1000 characters');
      }
      result.observation = proof.observation;
    }
    return result;
  }

  #validateMedia(media, field) {
    if (!media || typeof media !== 'object' || Array.isArray(media)) {
      throw HttpError.badRequest(`proof.${field} must be an object`);
    }
    const allowed = new Set(['url', 'storageKey']);
    if (Object.keys(media).some((key) => !allowed.has(key))) {
      throw HttpError.badRequest(`proof.${field} contains unsupported fields`);
    }
    for (const key of allowed) {
      const maxLength = key === 'url' ? 2048 : 512;
      const invalid = media[key] !== undefined
        && (typeof media[key] !== 'string' || media[key].length > maxLength);
      if (invalid) throw HttpError.badRequest(`proof.${field}.${key} must be a string within the allowed length`);
    }
    if (media.url) {
      let parsed;
      try { parsed = new URL(media.url); } catch { throw HttpError.badRequest(`proof.${field}.url must be a valid HTTP(S) URL`); }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw HttpError.badRequest(`proof.${field}.url must use HTTP or HTTPS`);
      }
    }
    return media;
  }
}

module.exports = { DeliveriesService, deliveriesService: new DeliveriesService() };
