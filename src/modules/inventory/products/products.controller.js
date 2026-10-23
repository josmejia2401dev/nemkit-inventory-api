'use strict';

const { success, created, paginated, createValidator } = require('nemkit');
const { productsService: service } = require('./products.service');
const { PRODUCT_STATUSES, PRODUCT_TYPES } = require('../inventory.constants');

const fields = {
  categoryId: { type: 'number', min: 1 },
  type: { type: 'string', enum: PRODUCT_TYPES },
  sku: { type: 'string', trim: true, minLength: 1, maxLength: 64 },
  barcode: { type: 'string', trim: true, maxLength: 64 },
  name: { type: 'string', trim: true, minLength: 1, maxLength: 160 },
  description: { type: 'string', trim: true, maxLength: 2000 },
  purchasePrice: { type: 'number', min: 0 },
  salePrice: { type: 'number', min: 0 },
  minimumStock: { type: 'number', min: 0 },
  status: { type: 'string', enum: PRODUCT_STATUSES },
  image: { type: 'object' },
};

const createSchema = createValidator({
  ...fields,
  categoryId: { ...fields.categoryId, required: true },
  sku: { ...fields.sku, required: true },
  name: { ...fields.name, required: true },
  purchasePrice: { ...fields.purchasePrice, required: true },
  salePrice: { ...fields.salePrice, required: true },
});

const updateSchema = createValidator(fields);

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
