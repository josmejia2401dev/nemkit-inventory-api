'use strict';

const EMPLOYEE_PAYMENT_TYPES = Object.freeze([
  'salary',
  'advance',
  'commission',
  'bonus',
  'other',
]);

const EMPLOYEE_PAYMENT_METHODS = Object.freeze([
  'cash',
  'bank_transfer',
  'other',
]);

module.exports = { EMPLOYEE_PAYMENT_TYPES, EMPLOYEE_PAYMENT_METHODS };
