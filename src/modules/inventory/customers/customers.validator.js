'use strict';

const { createValidator } = require('nemkit');

const fields = {
  name: { type: 'string', trim: true, minLength: 2, maxLength: 160 },
  document: { type: 'string', trim: true, maxLength: 40 },
  phone: { type: 'string', trim: true, maxLength: 40 },
  email: { type: 'string', trim: true, maxLength: 254 },
  address: { type: 'string', trim: true, maxLength: 300 },
  birthDate: { type: 'date' },
};

const createCustomerSchema = createValidator({ ...fields, name: { ...fields.name, required: true } });
const updateCustomerSchema = createValidator(fields);

module.exports = { createCustomerSchema, updateCustomerSchema };
