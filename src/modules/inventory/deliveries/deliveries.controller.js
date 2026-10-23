'use strict';

const { success, paginated, createValidator } = require('nemkit');
const { deliveriesService: service } = require('./deliveries.service');
const { DELIVERY_STATUSES } = require('../inventory.constants');

const statusSchema = createValidator({
  status: { type: 'string', required: true, enum: DELIVERY_STATUSES },
});

const courierSchema = createValidator({
  courierId: { type: 'number', required: true, min: 1 },
});

class DeliveriesController {
  async list(req, res, next) {
    try {
      const result = await service.list(req.user.id, req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      return success(res, await service.getOwned(req.params.id, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async assignCourier(req, res, next) {
    try {
      const { errorResponse, sanitized } = courierSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await service.assignCourier(req.params.id, sanitized.courierId, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async changeStatus(req, res, next) {
    try {
      const { errorResponse, sanitized } = statusSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await service.changeStatus(req.params.id, sanitized.status, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async setProof(req, res, next) {
    try {
      return success(res, await service.setProof(req.params.id, req.body?.proof, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async voidDelivery(req, res, next) {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 1000) : '';
      return success(res, await service.voidDelivery(req.params.id, req.user.id, { reason }), 'Delivery voided');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { deliveriesController: new DeliveriesController() };
