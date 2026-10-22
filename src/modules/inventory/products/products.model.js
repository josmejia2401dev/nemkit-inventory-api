'use strict';
const { mongoose, applyPlatformSchema, RECORD_STATUS } = require('nemkit');
const { PRODUCT_STATUS, PRODUCT_STATUSES } = require('../inventory.constants');

const ProductSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  categoryId: { type: Number, required: true, min: 1, index: true },
  sku: { type: String, required: true, trim: true, uppercase: true },
  barcode: { type: String, trim: true, default: '' },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, default: '', maxlength: 2000 },
  purchasePrice: { type: Number, required: true, min: 0 },
  salePrice: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  minimumStock: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  status: { type: String, enum: PRODUCT_STATUSES, default: PRODUCT_STATUS.ACTIVE },
  image: { url: { type: String, default: '' }, storageKey: { type: String, default: '' } },
});
ProductSchema.index({ userId: 1, sku: 1 }, { unique: true, partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE } });
ProductSchema.index({ userId: 1, barcode: 1 }, { unique: true, partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE, barcode: { $gt: '' } } });
ProductSchema.index({ userId: 1, status: 1, categoryId: 1, name: 1 });
module.exports = mongoose.model('inventory_products', ProductSchema);
