'use strict';

const { createValidator } = require('nemkit');
const { KITCHEN_STATUSES } = require('../inventory.constants');

const kitchenStatusSchema = createValidator({
  kitchenStatus: { type: 'string', required: true, enum: KITCHEN_STATUSES },
});

module.exports = { kitchenStatusSchema };
