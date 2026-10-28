'use strict';

const { createValidator } = require('nemkit');

const createCategorySchema = createValidator({
  name: { type: 'string', required: true, trim: true, minLength: 2, maxLength: 100 },
  description: { type: 'string', trim: true, maxLength: 1000 },
});

const updateCategorySchema = createValidator({
  name: { type: 'string', trim: true, minLength: 2, maxLength: 100 },
  description: { type: 'string', trim: true, maxLength: 1000 },
});

module.exports = { createCategorySchema, updateCategorySchema };
