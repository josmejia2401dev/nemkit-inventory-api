'use strict';

const { created, createValidator } = require('nemkit');
const { InventoryDocumentController } = require('../documents/document.controller');
const { purchasesService } = require('./purchases.service');

const schema = createValidator({
  supplierId: { type: 'number', required: true, min: 1 },
  date: { type: 'date' },
  notes: { type: 'string', trim: true, maxLength: 1000 },
  items: { type: 'array', required: true, minLength: 1 },
});

class PurchasesController extends InventoryDocumentController {
  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = schema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(res, await this.service.create(sanitized, req.user.id));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { purchasesController: new PurchasesController(purchasesService) };
