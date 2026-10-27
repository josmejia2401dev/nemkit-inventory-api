'use strict';

const { createValidator } = require('nemkit');
const { MOVEMENT_TYPES } = require('../inventory.constants');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isInteger = (value, field) => (Number.isSafeInteger(value) ? null : `${field} must be an integer`);
const dateFields = {
  from: { type: 'string', required: true, pattern: DATE_PATTERN },
  to: { type: 'string', required: true, pattern: DATE_PATTERN },
};
const paginationFields = {
  page: { type: 'number', toNumber: true, min: 1, max: 100000, custom: isInteger },
  limit: { type: 'number', toNumber: true, min: 1, max: 500, custom: isInteger },
};

const movementsQuerySchema = createValidator({
  ...dateFields,
  ...paginationFields,
  type: { type: 'string', enum: MOVEMENT_TYPES },
  productId: { type: 'number', toNumber: true, min: 1, custom: isInteger },
});

const salesQuerySchema = createValidator({
  ...dateFields,
  groupBy: { type: 'string', enum: ['day', 'week', 'month'] },
  employeeId: { type: 'number', toNumber: true, min: 1, custom: isInteger },
});

const salesByEmployeeQuerySchema = createValidator(dateFields);

const cancelledSalesQuerySchema = createValidator({
  ...dateFields,
  ...paginationFields,
});

module.exports = {
  movementsQuerySchema,
  salesQuerySchema,
  salesByEmployeeQuerySchema,
  cancelledSalesQuerySchema,
};
