'use strict';
const { mongoose, applyPlatformSchema } = require('nemkit');
const { MOVEMENT_TYPES, MOVEMENT_DIRECTIONS, MOVEMENT_SOURCE_TYPE } = require('../inventory.constants');

const MovementItemSchema = new mongoose.Schema({
  productId: { type: Number, required: true, min: 1 },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  direction: { type: String, enum: MOVEMENT_DIRECTIONS, required: true },
  unitCost: { type: Number, min: 0, default: null },
  unitPrice: { type: Number, min: 0, default: null },
}, { _id: false });

const MovementSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  date: { type: Date, default: Date.now, index: true },
  type: { type: String, enum: MOVEMENT_TYPES, required: true },
  notes: { type: String, trim: true, default: '', maxlength: 1000 },
  sourceType: { type: String, enum: Object.values(MOVEMENT_SOURCE_TYPE), default: null },
  sourceId: { type: Number, min: 1, default: null },
  items: { type: [MovementItemSchema], required: true, validate: { validator: (v) => v.length > 0, message: 'At least one item is required' } },
});
MovementSchema.index({ userId: 1, date: -1 });
MovementSchema.index({ userId: 1, type: 1, date: -1 });
MovementSchema.index({ userId: 1, 'items.productId': 1, date: -1 });
MovementSchema.index({ userId: 1, sourceType: 1, sourceId: 1 }, {
  unique: true,
  partialFilterExpression: { sourceId: { $type: 'number' } },
});
module.exports = mongoose.model('inventory_movements', MovementSchema);
