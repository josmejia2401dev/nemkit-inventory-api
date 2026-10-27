'use strict';

const { createValidator } = require('nemkit');

const profileSchema = createValidator({
  name: { type: 'string', required: true, trim: true, minLength: 2, maxLength: 160 },
  email: { type: 'email', required: true, trim: true, lowercase: true, maxLength: 254 },
  phone: { type: 'string', trim: true, maxLength: 40 },
});

const passwordSchema = createValidator({
  currentPassword: { type: 'string', required: true, minLength: 1, maxLength: 128 },
  newPassword: { type: 'string', required: true, minLength: 6, maxLength: 128 },
});

module.exports = { profileSchema, passwordSchema };
