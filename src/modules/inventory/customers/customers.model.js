'use strict';

const { mongoose, applyPlatformSchema, RECORD_STATUS } = require('nemkit');

const CustomerSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  document: { type: String, trim: true, default: '', maxlength: 40 },
  phone: { type: String, trim: true, default: '', maxlength: 40 },
  email: { type: String, trim: true, lowercase: true, default: '', maxlength: 254 },
});

CustomerSchema.index({ userId: 1, name: 1 });
CustomerSchema.index({ userId: 1, document: 1 }, {
  unique: true,
  partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE, document: { $gt: '' } },
});

module.exports = mongoose.model('inventory_customers', CustomerSchema);
