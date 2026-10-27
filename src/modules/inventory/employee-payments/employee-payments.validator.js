'use strict';

const { createValidator } = require('nemkit');
const { EMPLOYEE_PAYMENT_TYPES, EMPLOYEE_PAYMENT_METHODS } = require('./employee-payments.constants');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const positiveInteger = (value, field) => (Number.isSafeInteger(value) && value > 0 ? null : `${field} must be a positive integer`);
const listQuerySchema = createValidator({
  employeeId: { type: 'number', toNumber: true, min: 1, custom: positiveInteger },
  from: { type: 'string', pattern: DATE_PATTERN },
  to: { type: 'string', pattern: DATE_PATTERN },
  page: { type: 'number', toNumber: true, min: 1, max: 100000, custom: positiveInteger },
  limit: { type: 'number', toNumber: true, min: 1, max: 100, custom: positiveInteger },
});
const createPaymentSchema = createValidator({
  employeeId: { type: 'number', toNumber: true, min: 1, required: true, custom: positiveInteger },
  paymentDate: { type: 'date', required: true },
  periodStart: { type: 'date' },
  periodEnd: { type: 'date' },
  type: { type: 'string', enum: EMPLOYEE_PAYMENT_TYPES, required: true },
  amount: { type: 'number', toNumber: true, min: 0.01, required: true },
  method: { type: 'string', enum: EMPLOYEE_PAYMENT_METHODS },
  reference: { type: 'string', trim: true, maxLength: 120 },
  notes: { type: 'string', trim: true, maxLength: 1000 },
});

module.exports = { listQuerySchema, createPaymentSchema };
