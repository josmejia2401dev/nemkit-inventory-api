'use strict';

const { created, success, createValidator } = require('nemkit');
const { InventoryDocumentController } = require('../documents/document.controller');
const { salesService } = require('./sales.service');
const { KITCHEN_STATUSES, CANCEL_REASONS } = require('../inventory.constants');

const schema = createValidator({
  customerId: { type: 'number', required: true, min: 1 },
  employeeId: { type: 'number', min: 1 },
  date: { type: 'date' },
  notes: { type: 'string', trim: true, maxLength: 1000 },
  tableNumber: { type: 'string', trim: true, maxLength: 20 },
  items: { type: 'array', required: true, minLength: 1 },
});

const kitchenSchema = createValidator({
  kitchenStatus: { type: 'string', required: true, enum: KITCHEN_STATUSES },
});

const cancelSchema = createValidator({
  reason: { type: 'string', required: true, enum: CANCEL_REASONS },
  note: { type: 'string', trim: true, maxLength: 300 },
});

class SalesController extends InventoryDocumentController {
  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = schema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      if (sanitized.employeeId == null && req.user.employeeId != null) {
        sanitized.employeeId = req.user.employeeId;
      }
      // Bloque opcional de entrega a domicilio (objeto anidado; el validador
      // schema-based no lo cubre, se pasa desde el body crudo).
      if (req.body?.delivery && typeof req.body.delivery === 'object') {
        sanitized.delivery = req.body.delivery;
      }
      // Restaurante: la venta entra a cocina como comanda y queda "por cobrar"
      // hasta que se registre el pago al final.
      if (req.user.businessType === 'restaurant') {
        sanitized.kitchenStatus = 'pending';
        sanitized.paymentStatus = 'pending';
      }
      return created(res, await this.service.create(sanitized, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async kitchenQueue(req, res, next) {
    try {
      const includeServed = req.query.includeServed === 'true';
      return success(res, await this.service.kitchenQueue(req.user.id, { includeServed }));
    } catch (error) {
      next(error);
    }
  }

  async changeKitchen(req, res, next) {
    try {
      const { errorResponse, sanitized } = kitchenSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await this.service.changeKitchenStatus(req.params.id, sanitized.kitchenStatus, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  /** Registra el cobro de una venta "por cobrar" (restaurante). */
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
      // 'other' requiere una nota que explique el motivo.
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
      });
      return success(res, result, 'Pedido cancelado');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { salesController: new SalesController(salesService) };
