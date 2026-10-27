'use strict';

const { success, created, paginated } = require('nemkit');
const { movementsService: service } = require('./movements.service');
const { createMovementSchema: schema } = require('./movements.validator');

class MovementsController {
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
      const movement = await service.getOwned(+req.params.id, req.user.id);
      return success(res, movement);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = schema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      if (sanitized.employeeId == null && req.user.employeeId != null) {
        sanitized.employeeId = req.user.employeeId;
      }

      const movement = await service.create(sanitized, req.user.id);
      return created(res, movement);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { movementsController: new MovementsController() };
