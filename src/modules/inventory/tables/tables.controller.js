'use strict';

const { success, created, paginated } = require('nemkit');
const { tablesService: service } = require('./tables.service');
const { createTableSchema: createSchema, updateTableSchema: updateSchema } = require('./tables.validator');

class TablesController {
  async list(req, res, next) {
    try {
      const result = await service.list(req.user.id, req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async occupancy(req, res, next) {
    try {
      return success(res, await service.listWithOccupancy(req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = createSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(res, await service.create(sanitized, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { errorResponse, sanitized } = updateSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await service.update(req.params.id, sanitized, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await service.remove(req.params.id, req.user.id);
      return success(res, null, 'Table deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { tablesController: new TablesController() };
