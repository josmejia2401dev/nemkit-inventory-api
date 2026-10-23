'use strict';

const { success, created, paginated, createValidator } = require('nemkit');
const { customersService: service } = require('./customers.service');

const fields = {
  name: { type: 'string', trim: true, minLength: 2, maxLength: 160 },
  document: { type: 'string', trim: true, maxLength: 40 },
  phone: { type: 'string', trim: true, maxLength: 40 },
  email: { type: 'string', trim: true, maxLength: 254 },
  address: { type: 'string', trim: true, maxLength: 300 },
  birthDate: { type: 'date' },
};
const createSchema = createValidator({
  ...fields,
  name: { ...fields.name, required: true },
});
const updateSchema = createValidator(fields);

class CustomersController {
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
      return created(res, await service.create(sanitized, req.user.id));
    } catch (error) {
      next(error);
    }
  }
  async get(req, res, next) {
    try {
      return success(res, await service.getOwned(req.params.id, req.user.id));
    } catch (error) {
      next(error);
    }
  }
  async lookup(req, res, next) {
    try {
      const customer = await service.lookup(req.user.id, req.query.term);
      return success(res, customer);
    } catch (error) {
      next(error);
    }
  }
  async profile(req, res, next) {
    try {
      return success(res, await service.profile(req.params.id, req.user.id, req.query));
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
      return success(res, null, 'Customer deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { customersController: new CustomersController() };
