'use strict';

const { createValidator } = require('nemkit');

const fields = {
  name: { type: 'string', trim: true, minLength: 1, maxLength: 100 },
  description: { type: 'string', trim: true, maxLength: 1000 },
};

const createTableSchema = createValidator({ ...fields, name: { ...fields.name, required: true } });
const updateTableSchema = createValidator(fields);

module.exports = { createTableSchema, updateTableSchema };
