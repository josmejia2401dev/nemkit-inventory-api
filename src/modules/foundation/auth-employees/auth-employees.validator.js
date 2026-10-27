'use strict';

const { createValidator } = require('nemkit');

const loginSchema = createValidator({
  email: { type: 'email', required: true, trim: true, lowercase: true, maxLength: 254 },
  password: { type: 'string', required: true, minLength: 1, maxLength: 128 },
});

const refreshSchema = createValidator({
  refreshToken: { type: 'string', required: true, trim: true, minLength: 1, maxLength: 4096 },
});

const forgotPasswordSchema = createValidator({
  email: { type: 'email', required: true, trim: true, lowercase: true, maxLength: 254 },
});

const resetPasswordSchema = createValidator({
  token: { type: 'string', required: true, trim: true, minLength: 1, maxLength: 512 },
  newPassword: { type: 'string', required: true, minLength: 6, maxLength: 128 },
});

module.exports = { loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema };
