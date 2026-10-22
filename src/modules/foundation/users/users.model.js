'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

const UserSchema = applyPlatformSchema({
  fullName:     { type: String, required: true, trim: true },
  email:        { type: String, required: true, trim: true, lowercase: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  roles:        [{ type: String, enum: ['ADMIN', 'USER'], default: 'USER' }],
  security: {
    loginAttempts:      { type: Number, default: 0 },
    lastLockedAt:       { type: Date, default: null },
    lockedUntil:        { type: Date, default: null },
    lastLoginAt:        { type: Date, default: null },
    mustChangePassword: { type: Boolean, default: false },
    passwordResetToken: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
  },
});

module.exports = mongoose.model('users', UserSchema);
