'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');
const { DOCUMENT_STATUS } = require('../inventory.constants');

const SaleItemSchema = new mongoose.Schema({
  productId: { type: Number, required: true, min: 1 },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  unitPrice: { type: Number, required: true, min: 0 },
  unitCost: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const SaleSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  customerId: { type: Number, required: true, min: 1, index: true },
  customerSnapshot: {
    name: { type: String, required: true },
    document: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  date: { type: Date, required: true, index: true },
  status: { type: String, enum: Object.values(DOCUMENT_STATUS), default: DOCUMENT_STATUS.COMPLETED },
  notes: { type: String, trim: true, default: '', maxlength: 1000 },
  items: { type: [SaleItemSchema], required: true },
  total: { type: Number, required: true, min: 0 },
  movementId: { type: Number, required: true, min: 1, unique: true },
});
SaleSchema.index({ userId: 1, date: -1 });
SaleSchema.index({ userId: 1, customerId: 1, date: -1 });

module.exports = mongoose.model('inventory_sales', SaleSchema);
