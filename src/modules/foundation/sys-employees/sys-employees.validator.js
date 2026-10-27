'use strict';

const { createValidator, RECORD_STATUS } = require('nemkit');
const { EMPLOYEE_ROLES, EMPLOYEE_STATUSES } = require('../employees/employees.constants');

const isInteger = (value, field) => (
  Number.isSafeInteger(value) ? null : `${field} must be an integer`
);

const listQuerySchema = createValidator({
  page: { type: 'number', toNumber: true, min: 1, max: 100000, custom: isInteger },
  limit: { type: 'number', toNumber: true, min: 1, max: 100, custom: isInteger },
  search: { type: 'string', trim: true, maxLength: 100 },
  role: { type: 'string', enum: EMPLOYEE_ROLES },
  status: { type: 'string', enum: EMPLOYEE_STATUSES },
  recordStatus: { type: 'string', enum: Object.values(RECORD_STATUS) },
});

module.exports = { listQuerySchema };
