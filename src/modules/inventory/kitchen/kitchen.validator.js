'use strict';

const { createValidator } = require('nemkit');
const { ORDER_STATUSES } = require('../inventory.constants');

const orderStatusSchema = createValidator({
  orderStatus: { type: 'string', required: true, enum: ORDER_STATUSES },
});

module.exports = { orderStatusSchema };
