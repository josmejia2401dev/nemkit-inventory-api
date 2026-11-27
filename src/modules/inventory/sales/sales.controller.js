'use strict';

const { created, success } = require('nemkit');
const { InventoryDocumentController } = require('../documents/document.controller');
const { saleSchema, cancelSchema } = require('./sales.validator');
const { salesService } = require('./sales.service');

class SalesController extends InventoryDocumentController {
  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = saleSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      if (sanitized.employeeId == null && req.user.employeeId != null) {
        sanitized.employeeId = req.user.employeeId;
      }
      if (req.body?.delivery && typeof req.body.delivery === 'object') {
        sanitized.delivery = req.body.delivery;
      }
      return created(res, await this.service.create(sanitized, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  /** Registra el cobro de una venta pendiente. */
  async pay(req, res, next) {
    try {
      return success(res, await this.service.pay(req.params.id, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  /** Cancela un pedido/venta con un motivo. Repone stock (vía voidSale). */
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
      const result = await this.service.voidSale(req.params.id, req.user.id, {
        reason: sanitized.reason,
        note: sanitized.note ?? '',
        actorId: req.user.actorId ?? req.user.id,
        actorName: req.user.fullName ?? '',
      });
      return success(res, result, 'Pedido cancelado');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { salesController: new SalesController(salesService) };
