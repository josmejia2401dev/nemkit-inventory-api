'use strict';

const FEEDBACK_TYPE = Object.freeze({
  BUG: 'bug',
  SUGGESTION: 'suggestion',
  OTHER: 'other',
});

const FEEDBACK_STATUS = Object.freeze({
  OPEN: 'open',
  REVIEWED: 'reviewed',
  RESOLVED: 'resolved',
});

const FEEDBACK_TYPES = Object.freeze(Object.values(FEEDBACK_TYPE));
const FEEDBACK_STATUSES = Object.freeze(Object.values(FEEDBACK_STATUS));

module.exports = { FEEDBACK_TYPE, FEEDBACK_TYPES, FEEDBACK_STATUS, FEEDBACK_STATUSES };
