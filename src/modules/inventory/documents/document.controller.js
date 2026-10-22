'use strict';

const { success, created, paginated } = require('nemkit');

class InventoryDocumentController {
  constructor(service) {
    this.service = service;
  }

  async list(req, res, next) {
    try {
      const result = await this.service.list(req.user.id, req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const document = await this.service.getOwned(req.params.id, req.user.id);
      return success(res, document);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      return created(res, await this.service.create(req.body, req.user.id));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { InventoryDocumentController };
