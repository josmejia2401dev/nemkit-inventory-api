'use strict';

const { createValidator } = require('nemkit');

const businessSettingsSchema = createValidator({
  companyName: { type: 'string', trim: true, maxLength: 160 },
  businessType: { type: 'string', enum: ['retail', 'restaurant'] },
});

module.exports = { businessSettingsSchema };
