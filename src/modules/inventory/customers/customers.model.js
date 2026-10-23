'use strict';

const { mongoose, applyPlatformSchema, RECORD_STATUS } = require('nemkit');
const { LOYALTY_TIERS, LOYALTY_TIER } = require('../inventory.constants');

const CustomerSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  document: { type: String, trim: true, default: '', maxlength: 40 },
  phone: { type: String, trim: true, default: '', maxlength: 40 },
  email: { type: String, trim: true, lowercase: true, default: '', maxlength: 254 },
  address: { type: String, trim: true, default: '', maxlength: 300 },
  birthDate: { type: Date, default: null },
  // Métricas desnormalizadas: se actualizan en la transacción de cada venta.
  stats: {
    totalSpent: { type: Number, default: 0, min: 0 },
    purchaseCount: { type: Number, default: 0, min: 0 },
    firstPurchaseAt: { type: Date, default: null },
    lastPurchaseAt: { type: Date, default: null },
  },
  loyaltyTier: { type: String, enum: LOYALTY_TIERS, default: LOYALTY_TIER.BRONZE, index: true },
});

CustomerSchema.index({ userId: 1, name: 1 });
CustomerSchema.index({ userId: 1, document: 1 }, {
  unique: true,
  partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE, document: { $gt: '' } },
});
CustomerSchema.index({ userId: 1, phone: 1 }, {
  partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE, phone: { $gt: '' } },
});

module.exports = mongoose.model('inventory_customers', CustomerSchema);
