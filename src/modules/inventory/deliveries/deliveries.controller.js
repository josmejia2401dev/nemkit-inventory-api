'use strict';

const { success, paginated, HttpError } = require('nemkit');
const { deliveriesService: service } = require('./deliveries.service');
const { DELIVERY_STATUS } = require('../inventory.constants');
const {
  statusSchema,
  courierSchema,
  listQuerySchema,
  proofSchema,
  voidSchema,
  validateProof,
} = require('./deliveries.validator');

function check(schema, data, req, res) {
  const result = schema.check(data ?? {}, req);
  if (result.errorResponse) {
    res.status(400).json(result.errorResponse);
    return null;
  }
  return result.sanitized;
}

/**
 * Si el usuario es domiciliario (COURIER sin ser ADMIN), devuelve el
 * contexto que restringe las operaciones a SUS domicilios asignados. Para el
 * resto de roles devuelve contexto vacío (ven/gestionan todos los del empresa).
 */
function courierContext(req) {
  const roles = req.user?.roles ?? [];
  const privileged = roles.includes('ADMIN');
  if (!privileged && roles.includes('COURIER')) {
    return { restrictToCourierId: req.user.employeeId ?? 0 };
  }
  return {};
}

class DeliveriesController {
  async list(req, res, next) {
    try {
      const query = check(listQuerySchema, req.query, req, res);
      if (!query) return;
      const result = await service.list(req.user.id, query, courierContext(req));
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
      if ([DELIVERY_STATUS.PREPARING, DELIVERY_STATUS.READY].includes(sanitized.status)) {
        const roles = req.user?.roles ?? [];
        if (!roles.includes('ADMIN') && !roles.includes('SELLER')) {
          throw HttpError.forbidden('Only the store administrator or seller can update preparation status');
        }
      }
      const context = courierContext(req);
      if (sanitized.status === DELIVERY_STATUS.CANCELLED && context.restrictToCourierId != null) {
        throw HttpError.forbidden('Only management can cancel an order');
      }
      return success(res, await service.changeStatus(req.params.id, sanitized.status, req.user.id, context));
    } catch (error) {
      next(error);
    }
  }

  async setProof(req, res, next) {
    try {
      const payload = check(proofSchema, { proof: req.body?.proof }, req, res);
      if (!payload) return;
      return success(res, await service.setProof(req.params.id, validateProof(payload.proof), req.user.id, courierContext(req)));
    } catch (error) {
      next(error);
    }
  }

  async voidDelivery(req, res, next) {
    try {
      const payload = check(voidSchema, req.body, req, res);
      if (!payload) return;
      const ctx = courierContext(req);
      return success(res, await service.voidDelivery(req.params.id, req.user.id, { reason: payload.reason ?? '', ...ctx }), 'Delivery voided');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { deliveriesController: new DeliveriesController() };
