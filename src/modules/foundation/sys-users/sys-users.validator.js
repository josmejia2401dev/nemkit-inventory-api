'use strict';

const { createValidator } = require('nemkit');

const isInteger = (value, field) => (Number.isSafeInteger(value) ? null : `${field} must be an integer`);

const listQuerySchema = createValidator({
  page: { type: 'number', toNumber: true, min: 1, max: 100000, custom: isInteger },
  limit: { type: 'number', toNumber: true, min: 1, max: 100, custom: isInteger },
  search: { type: 'string', trim: true, maxLength: 100 },
  role: { type: 'string', trim: true, uppercase: true, maxLength: 40 },
  kind: { type: 'string', enum: ['owner', 'employee', 'unassigned_employee', 'super_admin'] },
});

const userIdSchema = createValidator({
  id: { type: 'number', required: true, toNumber: true, min: 1, custom: isInteger },
});

module.exports = { listQuerySchema, userIdSchema };
