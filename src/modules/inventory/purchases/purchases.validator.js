'use strict';

const { createValidator } = require('nemkit');

const createPurchaseSchema = createValidator({
  supplierId: { type: 'number', required: true, min: 1 },
  employeeId: { type: 'number', min: 1 },
  date: { type: 'date' },
  notes: { type: 'string', trim: true, maxLength: 1000 },
  items: { type: 'array', required: true, minLength: 1 },
});

module.exports = { createPurchaseSchema };
