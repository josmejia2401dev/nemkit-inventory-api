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

/**
 * Si el usuario es domiciliario (COURIER sin ser ADMIN/SUPERADMIN), devuelve el
 * contexto que restringe las operaciones a SUS domicilios asignados. Para el
 * resto de roles devuelve contexto vacío (ven/gestionan todos los del tenant).
 */
function courierContext(req) {
  const roles = req.user?.roles ?? [];
  const privileged = roles.includes('ADMIN') || roles.includes('SUPERADMIN');
  if (!privileged && roles.includes('COURIER') && req.user.employeeId != null) {
    return { restrictToCourierId: req.user.employeeId };
  }
  return {};
}

class DeliveriesController {
  async list(req, res, next) {
    try {
      const result = await service.list(req.user.id, req.query, courierContext(req));
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      return success(res, await service.getOwned(req.params.id, req.user.id, courierContext(req)));
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
      return success(res, await service.changeStatus(req.params.id, sanitized.status, req.user.id, courierContext(req)));
    } catch (error) {
      next(error);
    }
  }

  async setProof(req, res, next) {
    try {
      return success(res, await service.setProof(req.params.id, req.body?.proof, req.user.id, courierContext(req)));
    } catch (error) {
      next(error);
    }
  }

  async voidDelivery(req, res, next) {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 1000) : '';
      const ctx = courierContext(req);
      return success(res, await service.voidDelivery(req.params.id, req.user.id, { reason, ...ctx }), 'Delivery voided');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { deliveriesController: new DeliveriesController() };
