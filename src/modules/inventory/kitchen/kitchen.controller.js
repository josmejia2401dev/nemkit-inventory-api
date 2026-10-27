'use strict';

const { success } = require('nemkit');
const { kitchenService } = require('./kitchen.service');
const { orderStatusSchema } = require('./kitchen.validator');
const { cancelSchema } = require('../sales/sales.validator');

class KitchenController {
  async queue(req, res, next) {
    try {
      return success(res, await kitchenService.list(req.user.id, {
        includeCompleted: req.query.includeCompleted === 'true',
      }));
    } catch (error) {
      next(error);
    }
  }

  async changeStatus(req, res, next) {
    try {
      const { errorResponse, sanitized } = orderStatusSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await kitchenService.changeStatus(
        req.params.id,
        sanitized.orderStatus,
        req.user.id,
        req.user.businessType,
        req.user.roles ?? [],
      ));
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const { errorResponse, sanitized } = cancelSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      if (sanitized.reason === 'other' && !(sanitized.note && sanitized.note.trim())) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Escribe el motivo cuando seleccionas "Otro"',
          metadata: { requestId: req.requestId ?? null },
        });
      }

      const result = await kitchenService.cancel(req.params.id, req.user.id, {
        reason: sanitized.reason,
        note: sanitized.note ?? '',
      });
      return success(res, result, 'Pedido cancelado');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { KitchenController, kitchenController: new KitchenController() };
