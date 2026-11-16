'use strict';

const { createValidator } = require('nemkit');
const { CASH_WITHDRAWAL_REASONS, CASH_WITHDRAWAL_METHODS } = require('./cash-withdrawals.constants');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const positiveInteger = (value, field) => (Number.isSafeInteger(value) && value > 0 ? null : `${field} must be a positive integer`);
const money = (value, field) => (Number.isFinite(value) && value > 0 ? null : `${field} must be greater than zero`);

const listWithdrawalsQuerySchema = createValidator({
  from: { type: 'string', pattern: DATE_PATTERN },
  to: { type: 'string', pattern: DATE_PATTERN },
  reason: { type: 'string', enum: CASH_WITHDRAWAL_REASONS },
  page: { type: 'number', toNumber: true, min: 1, max: 100000, custom: positiveInteger },
  limit: { type: 'number', toNumber: true, min: 1, max: 100, custom: positiveInteger },
});

const summaryQuerySchema = createValidator({
  from: { type: 'string', pattern: DATE_PATTERN },
  to: { type: 'string', pattern: DATE_PATTERN },
});

const createWithdrawalSchema = createValidator({
  date: { type: 'date', required: true },
  amount: { type: 'number', toNumber: true, min: 0.01, required: true, custom: money },
  reason: { type: 'string', enum: CASH_WITHDRAWAL_REASONS, required: true },
  beneficiary: { type: 'string', trim: true, maxLength: 120 },
  method: { type: 'string', enum: CASH_WITHDRAWAL_METHODS },
  reference: { type: 'string', trim: true, maxLength: 120 },
  notes: { type: 'string', trim: true, maxLength: 1000 },
});

module.exports = { listWithdrawalsQuerySchema, summaryQuerySchema, createWithdrawalSchema };
