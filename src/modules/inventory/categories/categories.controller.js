'use strict';

const { success, created, paginated } = require('nemkit');
const { categoriesService: service } = require('./categories.service');
const { createCategorySchema: createSchema, updateCategorySchema: updateSchema } = require('./categories.validator');

class CategoriesController {
  async list(req, res, next) {
    try {
      const result = await service.list(req.user.id, req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = createSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);

      const category = await service.create(sanitized, req.user.id);
      return created(res, category);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { errorResponse, sanitized } = updateSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);

      const category = await service.update(+req.params.id, sanitized, req.user.id);
      return success(res, category);
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await service.remove(+req.params.id, req.user.id);
      return success(res, null, 'Category deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { categoriesController: new CategoriesController() };
