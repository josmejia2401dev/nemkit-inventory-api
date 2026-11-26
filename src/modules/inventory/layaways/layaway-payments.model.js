'use strict';

const { applyPlatformSchema } = require('nemkit');
const {
  LAYAWAY_PAYMENT_TYPES,
  LAYAWAY_PAYMENT_METHODS,
} = require('../inventory.constants');

const LayawayPaymentSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  layawayId: { type: Number, required: true, index: true },
  type: { type: String, enum: LAYAWAY_PAYMENT_TYPES, required: true },
  date: { type: Date, required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: LAYAWAY_PAYMENT_METHODS, default: 'cash' },
  reference: { type: String, trim: true, default: '', maxlength: 100 },
  notes: { type: String, trim: true, default: '', maxlength: 300 },
  employeeId: { type: Number, default: null },
  employeeSnapshot: { name: { type: String, default: '' } },
});

LayawayPaymentSchema.index({ userId: 1, layawayId: 1, date: -1 });
LayawayPaymentSchema.index({ userId: 1, date: -1 });

module.exports = require('nemkit').mongoose.model('inventory_layaway_payments', LayawayPaymentSchema);
