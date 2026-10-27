'use strict';

const { createValidator } = require('nemkit');
const { PRODUCT_STATUSES, PRODUCT_TYPES } = require('../inventory.constants');

const fields = {
  categoryId: { type: 'number', min: 1 },
  type: { type: 'string', enum: PRODUCT_TYPES },
  sku: { type: 'string', trim: true, minLength: 1, maxLength: 64 },
  barcode: { type: 'string', trim: true, maxLength: 64 },
  name: { type: 'string', trim: true, minLength: 1, maxLength: 160 },
  description: { type: 'string', trim: true, maxLength: 2000 },
  purchasePrice: { type: 'number', min: 0 },
  salePrice: { type: 'number', min: 0 },
  minimumStock: { type: 'number', min: 0 },
  status: { type: 'string', enum: PRODUCT_STATUSES },
  image: { type: 'object' },
};

const createProductSchema = createValidator({
  ...fields,
  categoryId: { ...fields.categoryId, required: true },
  sku: { ...fields.sku, required: true },
  name: { ...fields.name, required: true },
  // El precio de compra es opcional (los platos no se compran). Por defecto 0.
  salePrice: { ...fields.salePrice, required: true },
});

const updateProductSchema = createValidator(fields);

module.exports = { createProductSchema, updateProductSchema };
