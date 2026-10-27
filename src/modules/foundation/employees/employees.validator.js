'use strict';

const { createValidator, HttpError } = require('nemkit');
const { EMPLOYEE_ROLES, EMPLOYEE_STATUSES, DOCUMENT_TYPES } = require('./employees.constants');
const EMPLOYEE_LIST_STATUSES = [...EMPLOYEE_STATUSES, 'all'];

const fields = {
  name: { type: 'string', trim: true, minLength: 2, maxLength: 160 },
  documentType: { type: 'string', enum: DOCUMENT_TYPES },
  documentNumber: { type: 'string', trim: true, maxLength: 40 },
  phone: { type: 'string', trim: true, maxLength: 40 },
  email: { type: 'email', trim: true, lowercase: true, maxLength: 254 },
  role: { type: 'string', enum: EMPLOYEE_ROLES },
  hireDate: { type: 'date' },
  status: { type: 'string', enum: EMPLOYEE_STATUSES },
  photo: { type: 'object' },
};

const validateInteger = (value, field) => (Number.isSafeInteger(value) ? null : `${field} must be an integer`);

const createSchema = createValidator({
  ...fields,
  name: { ...fields.name, required: true },
  role: { ...fields.role, required: true },
  email: { ...fields.email, required: true },
  password: { type: 'string', required: true, minLength: 6, maxLength: 128 },
});

const updateSchema = createValidator(fields);
const adminPasswordSchema = createValidator({
  newPassword: { type: 'string', required: true, minLength: 6, maxLength: 128 },
});
const listQuerySchema = createValidator({
  page: { type: 'number', toNumber: true, min: 1, max: 100000, custom: validateInteger },
  limit: { type: 'number', toNumber: true, min: 1, max: 100, custom: validateInteger },
  role: { type: 'string', enum: EMPLOYEE_ROLES },
  status: { type: 'string', enum: EMPLOYEE_LIST_STATUSES },
  search: { type: 'string', trim: true, maxLength: 100 },
});

const optionsQuerySchema = createValidator({
  role: { type: 'string', enum: EMPLOYEE_ROLES },
});

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

module.exports = {
  createSchema,
  updateSchema,
  adminPasswordSchema,
  listQuerySchema,
  optionsQuerySchema,
  validatePhoto,
};
