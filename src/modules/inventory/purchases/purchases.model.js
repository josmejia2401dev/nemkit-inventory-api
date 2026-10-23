'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');
const { DOCUMENT_STATUS } = require('../inventory.constants');

const PurchaseItemSchema = new mongoose.Schema({
  productId: { type: Number, required: true, min: 1 },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  unitCost: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const PurchaseSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  supplierId: { type: Number, required: true, min: 1, index: true },
  supplierSnapshot: {
    name: { type: String, required: true },
    document: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  employeeId: { type: Number, default: null, index: true },
  employeeSnapshot: { name: { type: String, default: '' } },
  date: { type: Date, required: true, index: true },
  status: { type: String, enum: Object.values(DOCUMENT_STATUS), default: DOCUMENT_STATUS.COMPLETED },
  notes: { type: String, trim: true, default: '', maxlength: 1000 },
  items: { type: [PurchaseItemSchema], required: true },
  total: { type: Number, required: true, min: 0 },
  movementId: { type: Number, required: true, min: 1, unique: true },
});
PurchaseSchema.index({ userId: 1, date: -1 });
PurchaseSchema.index({ userId: 1, supplierId: 1, date: -1 });
PurchaseSchema.index({ userId: 1, employeeId: 1, date: -1 });

module.exports = mongoose.model('inventory_purchases', PurchaseSchema);
