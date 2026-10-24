'use strict';

const { createValidator } = require('nemkit');
const { EMPLOYEE_ROLES } = require('../inventory.constants');

const associateEmployeeSchema = createValidator({
  email: { type: 'email', required: true, trim: true, maxLength: 254 },
  role: { type: 'string', required: true, enum: EMPLOYEE_ROLES },
});

module.exports = { associateEmployeeSchema };
