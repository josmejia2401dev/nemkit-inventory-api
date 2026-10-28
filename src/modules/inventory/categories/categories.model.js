'use strict';
const { mongoose, applyPlatformSchema, RECORD_STATUS } = require('nemkit');

const CategorySchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  nameKey: { type: String, required: true, trim: true, lowercase: true, select: false },
  description: { type: String, trim: true, default: '', maxlength: 1000 },
});
CategorySchema.index({ userId: 1, nameKey: 1 }, { unique: true, partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE } });
module.exports = mongoose.model('inventory_categories', CategorySchema);
