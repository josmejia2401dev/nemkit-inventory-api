'use strict';

const { success, created, paginated, createValidator } = require('nemkit');
const { movementsService: service } = require('./movements.service');
const { MOVEMENT_TYPE, MOVEMENT_TYPES } = require('../inventory.constants');

const CREATABLE_MOVEMENT_TYPES = MOVEMENT_TYPES.filter((type) => ![
  MOVEMENT_TYPE.PURCHASE,
  MOVEMENT_TYPE.SALE,
].includes(type));

const schema = createValidator({
  type: { type: 'string', required: true, enum: CREATABLE_MOVEMENT_TYPES },
  employeeId: { type: 'number', min: 1 },
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
