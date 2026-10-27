'use strict';

const { success, created, paginated } = require('nemkit');
const { employeesService: service } = require('./employees.service');
const {
  createSchema,
  updateSchema,
  adminPasswordSchema,
  listQuerySchema,
  optionsQuerySchema,
  validatePhoto,
} = require('./employees.validator');

function check(schema, data, req, res) {
  const result = schema.check(data ?? {}, req);
  if (result.errorResponse) {
    res.status(400).json(result.errorResponse);
    return null;
  }
  return result.sanitized;
}

class EmployeesController {
  async list(req, res, next) {
    try {
      const query = check(listQuerySchema, req.query, req, res);
      if (!query) return;
      const result = await service.list(req.user.id, query);
      return paginated(res, result.data, result.pagination);
    } catch (error) { next(error); }
  }

  async options(req, res, next) {
    try {
      const query = check(optionsQuerySchema, req.query, req, res);
      if (!query) return;
      return success(res, await service.options(req.user.id, query));
    } catch (error) { next(error); }
  }

  async create(req, res, next) {
    try {
      const sanitized = check(createSchema, req.body, req, res);
      if (!sanitized) return;
      const photo = validatePhoto(sanitized.photo);
      if (photo !== undefined) sanitized.photo = photo;
      return created(res, await service.create(
        sanitized,
        req.user.id,
        req.user.actorId ?? req.user.id,
      ));
    } catch (error) { next(error); }
  }

  async get(req, res, next) {
    try {
      return success(res, await service.getOwned(req.params.id, req.user.id));
    } catch (error) { next(error); }
  }

  async update(req, res, next) {
    try {
      const sanitized = check(updateSchema, req.body, req, res);
      if (!sanitized) return;
      const photo = validatePhoto(sanitized.photo);
      if (photo !== undefined) sanitized.photo = photo;
      return success(res, await service.update(
        req.params.id,
        sanitized,
        req.user.id,
        req.user.actorId ?? req.user.id,
      ));
    } catch (error) { next(error); }
  }

  async remove(req, res, next) {
    try {
      await service.remove(req.params.id, req.user.id, req.user.actorId ?? req.user.id);
      return success(res, null, 'Employee removed');
    } catch (error) { next(error); }
  }

  async resetPassword(req, res, next) {
    try {
      const sanitized = check(adminPasswordSchema, req.body, req, res);
      if (!sanitized) return;
      return success(res, await service.resetPassword(
        req.params.id,
        req.user.id,
        sanitized.newPassword,
        req.user.actorId ?? req.user.id,
      ), 'Temporary password set');
    } catch (error) { next(error); }
  }
}

module.exports = { EmployeesController, employeesController: new EmployeesController() };
