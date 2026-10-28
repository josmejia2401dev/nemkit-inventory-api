'use strict';

const { createValidator } = require('nemkit');
const { FEEDBACK_TYPES, FEEDBACK_STATUSES } = require('./feedback.constants');

const feedbackCreateSchema = createValidator({
  title: { type: 'string', required: true, trim: true, minLength: 3, maxLength: 100 },
  description: { type: 'string', required: true, trim: true, minLength: 3, maxLength: 1000 },
  type: { type: 'string', enum: FEEDBACK_TYPES },
});

const feedbackStatusSchema = createValidator({
  status: { type: 'string', required: true, enum: FEEDBACK_STATUSES },
});

module.exports = { feedbackCreateSchema, feedbackStatusSchema };
