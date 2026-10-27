'use strict';

const { success, created, paginated } = require('nemkit');
const { productsService: service } = require('./products.service');
const { createProductSchema: createSchema, updateProductSchema: updateSchema } = require('./products.validator');

class ProductsController {
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
      const product = await service.getOwned(+req.params.id, req.user.id);
      return success(res, product);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = createSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      if (Array.isArray(req.body?.recipe)) sanitized.recipe = req.body.recipe;

      const product = await service.create(sanitized, req.user.id);
      return created(res, product);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { errorResponse, sanitized } = updateSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      if (Array.isArray(req.body?.recipe)) sanitized.recipe = req.body.recipe;

      const product = await service.update(+req.params.id, sanitized, req.user.id);
      return success(res, product);
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await service.remove(+req.params.id, req.user.id);
      return success(res, null, 'Product deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { productsController: new ProductsController() };
