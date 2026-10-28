'use strict';

const { success, created, paginated } = require('nemkit');
const { customersService: service } = require('./customers.service');
const { createCustomerSchema: createSchema, updateCustomerSchema: updateSchema } = require('./customers.validator');

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
