'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

const TokenSchema = applyPlatformSchema({
  userId:   { type: Number, required: true },
  audience: { type: String, required: true, enum: ['web', 'app'] },
  deviceInfo: { ip: { type: String, default: null }, userAgent: { type: String, default: null } },
  expiresAt: { type: Date, required: true },
});

TokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
TokenSchema.index({ userId: 1, audience: 1 }, { unique: true });

module.exports = mongoose.model('tokens', TokenSchema);
