'use strict';

const { createValidator } = require('nemkit');

const createCategorySchema = createValidator({
  name: { type: 'string', required: true, trim: true, minLength: 2, maxLength: 100 },
  description: { type: 'string', trim: true, maxLength: 500 },
});

const updateCategorySchema = createValidator({
  name: { type: 'string', trim: true, minLength: 2, maxLength: 100 },
  description: { type: 'string', trim: true, maxLength: 500 },
});

module.exports = { createCategorySchema, updateCategorySchema };
