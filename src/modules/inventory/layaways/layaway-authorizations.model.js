'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

const LayawayAuthorizationSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  customerId: { type: Number, required: true, index: true },
  total: { type: Number, required: true, min: 0 },
  requestedBy: { type: Number, required: true },
  authorizedBy: { type: Number, required: true },
  authorizedByName: { type: String, default: '' },
  method: { type: String, enum: ['password'], default: 'password' },
  reason: { type: String, trim: true, default: '', maxlength: 300 },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});

LayawayAuthorizationSchema.index({ userId: 1, createdAt: -1 });
LayawayAuthorizationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('inventory_layaway_authorizations', LayawayAuthorizationSchema);
