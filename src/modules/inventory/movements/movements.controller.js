'use strict';

const { success, created, paginated, createValidator } = require('nemkit');
const { movementsService: service } = require('./movements.service');
const { MOVEMENT_TYPES } = require('../inventory.constants');

const schema = createValidator({
  type: { type: 'string', required: true, enum: MOVEMENT_TYPES },
  date: { type: 'date' },
  notes: { type: 'string', trim: true, maxLength: 1000 },
  items: { type: 'array', required: true, minLength: 1 },
});

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

      const movement = await service.create(sanitized, req.user.id);
      return created(res, movement);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { movementsController: new MovementsController() };
