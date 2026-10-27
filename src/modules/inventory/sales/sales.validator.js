'use strict';

const { createValidator } = require('nemkit');
const { CANCEL_REASONS, ORDER_STATUSES } = require('../inventory.constants');

const saleSchema = createValidator({
  customerId: { type: 'number', required: true, min: 1 },
  employeeId: { type: 'number', min: 1 },
  date: { type: 'date' },
  notes: { type: 'string', trim: true, maxLength: 1000 },
  tableNumber: { type: 'string', trim: true, maxLength: 20 },
  items: { type: 'array', required: true, minLength: 1 },
});

const cancelSchema = createValidator({
  reason: { type: 'string', required: true, enum: CANCEL_REASONS },
  note: { type: 'string', trim: true, maxLength: 300 },
});

const orderStatusSchema = createValidator({
  orderStatus: { type: 'string', required: true, enum: ORDER_STATUSES },
});

module.exports = { saleSchema, cancelSchema, orderStatusSchema };
