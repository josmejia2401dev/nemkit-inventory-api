'use strict';

const ANNOUNCEMENT_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

const ANNOUNCEMENT_STATUSES = Object.freeze(Object.values(ANNOUNCEMENT_STATUS));
const ANNOUNCEMENT_CATEGORY = Object.freeze({
  RELEASE: 'release',
  MAINTENANCE: 'maintenance',
  BILLING: 'billing',
});
const ANNOUNCEMENT_CATEGORIES = Object.freeze(Object.values(ANNOUNCEMENT_CATEGORY));

module.exports = {
  ANNOUNCEMENT_STATUS,
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_CATEGORY,
  ANNOUNCEMENT_CATEGORIES,
};
