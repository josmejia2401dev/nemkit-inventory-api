'use strict';

const { success, created, paginated, createValidator, HttpError } = require('nemkit');
const { employeesService: service } = require('./employees.service');
const {
  EMPLOYEE_ROLES,
  DOCUMENT_TYPES,
  EMPLOYEE_STATUSES,
} = require('../inventory.constants');

const fields = {
  name: { type: 'string', trim: true, minLength: 2, maxLength: 160 },
  documentType: { type: 'string', enum: DOCUMENT_TYPES },
  documentNumber: { type: 'string', trim: true, maxLength: 40 },
  phone: { type: 'string', trim: true, maxLength: 40 },
  email: { type: 'string', trim: true, maxLength: 254 },
  role: { type: 'string', enum: EMPLOYEE_ROLES },
  hireDate: { type: 'date' },
  status: { type: 'string', enum: EMPLOYEE_STATUSES },
};

const createSchema = createValidator({
  ...fields,
  name: { ...fields.name, required: true },
  role: { ...fields.role, required: true },
  email: { ...fields.email, type: 'email', required: true },
  password: { type: 'string', required: true, minLength: 6, maxLength: 128 },
});
const updateSchema = createValidator(fields);

function validateEmail(email) {
  if (email !== undefined && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw HttpError.badRequest('email must be a valid email address');
  }
}

function validatePhoto(photo) {
  if (photo === undefined) return undefined;
  if (!photo || typeof photo !== 'object' || Array.isArray(photo)) {
    throw HttpError.badRequest('photo must be an object');
  }
  const allowed = new Set(['url', 'storageKey']);
  if (Object.keys(photo).some((key) => !allowed.has(key))) {
    throw HttpError.badRequest('photo contains unsupported fields');
  }
  for (const field of allowed) {
    const maxLength = field === 'url' ? 2048 : 512;
    const invalid = photo[field] !== undefined
      && (typeof photo[field] !== 'string' || photo[field].length > maxLength);
    if (invalid) throw HttpError.badRequest(`photo.${field} must be a string within the allowed length`);
  }
  if (photo.url) {
    let parsed;
    try { parsed = new URL(photo.url); } catch { throw HttpError.badRequest('photo.url must be a valid HTTP(S) URL'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw HttpError.badRequest('photo.url must use HTTP or HTTPS');
    }
  }
  return photo;
}

class EmployeesController {
  async list(req, res, next) {
    try {
      const result = await service.list(req.user.id, req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async options(req, res, next) {
    try {
      return success(res, await service.options(req.user.id, req.query));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = createSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      validateEmail(sanitized.email);
      const photo = validatePhoto(req.body?.photo);
      if (photo !== undefined) sanitized.photo = photo;
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

  async update(req, res, next) {
    try {
      const { errorResponse, sanitized } = updateSchema.check(req.body, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      validateEmail(sanitized.email);
      const photo = validatePhoto(req.body?.photo);
      if (photo !== undefined) sanitized.photo = photo;
      return success(res, await service.update(req.params.id, sanitized, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await service.remove(req.params.id, req.user.id);
      return success(res, null, 'Employee deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { employeesController: new EmployeesController() };
