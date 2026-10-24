'use strict';

const { mongoose, applyPlatformSchema, RECORD_STATUS } = require('nemkit');

/** Mesa de un restaurante: solo nombre y una descripción opcional. */
const TableSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 40 },
  description: { type: String, trim: true, default: '', maxlength: 200 },
});

TableSchema.index({ userId: 1, name: 1 }, {
  unique: true,
  partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE },
});

module.exports = mongoose.model('inventory_tables', TableSchema);
