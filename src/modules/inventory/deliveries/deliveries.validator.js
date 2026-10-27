'use strict';

const { createValidator } = require('nemkit');
const { DELIVERY_STATUSES } = require('../inventory.constants');

const statusSchema = createValidator({
  status: { type: 'string', required: true, enum: DELIVERY_STATUSES },
});

const courierSchema = createValidator({
  courierId: { type: 'number', required: true, min: 1 },
});

module.exports = { statusSchema, courierSchema };
