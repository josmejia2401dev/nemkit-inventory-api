'use strict';

const { created, success, createValidator } = require('nemkit');
const { InventoryDocumentController } = require('../documents/document.controller');
const { salesService } = require('./sales.service');
const { KITCHEN_STATUSES } = require('../inventory.constants');

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
      // Restaurante: la venta entra a cocina como comanda pendiente.
      if (req.user.businessType === 'restaurant') {
        sanitized.kitchenStatus = 'pending';
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
}

module.exports = { salesController: new SalesController(salesService) };
