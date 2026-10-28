'use strict';

const { createValidator } = require('nemkit');
const { MOVEMENT_TYPES } = require('../inventory.constants');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const integer = (value, field) => (Number.isSafeInteger(value) ? null : `${field} must be an integer`);
const dateFields = {
  from: { type: 'string', required: true, pattern: DATE_PATTERN },
  to: { type: 'string', required: true, pattern: DATE_PATTERN },
};
const paginationFields = {
  page: { type: 'number', toNumber: true, min: 1, max: 100000, custom: integer },
  limit: { type: 'number', toNumber: true, min: 1, max: 500, custom: integer },
};

module.exports = {
  customerProfileQuerySchema: createValidator({
    page: paginationFields.page,
    limit: { ...paginationFields.limit, max: 100 },
  }),
  paymentSummaryQuerySchema: createValidator({
    from: { type: 'string', pattern: DATE_PATTERN },
    to: { type: 'string', pattern: DATE_PATTERN },
    employeeId: { type: 'number', toNumber: true, min: 1, custom: integer },
  }),
  movementsQuerySchema: createValidator({
    ...dateFields,
    ...paginationFields,
    type: { type: 'string', enum: MOVEMENT_TYPES },
    productId: { type: 'number', toNumber: true, min: 1, custom: integer },
  }),
  salesQuerySchema: createValidator({
    ...dateFields,
    groupBy: { type: 'string', enum: ['day', 'week', 'month'] },
    employeeId: { type: 'number', toNumber: true, min: 1, custom: integer },
  }),
  salesByEmployeeQuerySchema: createValidator(dateFields),
  cancelledSalesQuerySchema: createValidator({ ...dateFields, ...paginationFields }),
};
