'use strict';

const { created } = require('nemkit');
const { InventoryDocumentController } = require('../documents/document.controller');
const { purchasesService } = require('./purchases.service');
const { createPurchaseSchema: schema } = require('./purchases.validator');

class PurchasesController extends InventoryDocumentController {
  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = schema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      if (sanitized.employeeId == null && req.user.employeeId != null) {
        sanitized.employeeId = req.user.employeeId;
      }
      return created(res, await this.service.create(sanitized, req.user.id));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { purchasesController: new PurchasesController(purchasesService) };
