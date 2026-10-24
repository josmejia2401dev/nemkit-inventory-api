'use strict';

const { createValidator } = require('nemkit');
const { ANNOUNCEMENT_CATEGORIES } = require('./announcements.constants');

const announcementFields = {
  title: { type: 'string', trim: true, minLength: 2, maxLength: 160 },
  summary: { type: 'string', trim: true, minLength: 2, maxLength: 300 },
  content: { type: 'string', trim: true, minLength: 2, maxLength: 12000 },
  category: { type: 'string', enum: ANNOUNCEMENT_CATEGORIES },
  expiresAt: { type: 'date' },
};

const createAnnouncementSchema = createValidator({
  ...announcementFields,
  title: { ...announcementFields.title, required: true },
  summary: { ...announcementFields.summary, required: true },
  content: { ...announcementFields.content, required: true },
  category: { ...announcementFields.category, required: true },
});

const updateAnnouncementSchema = createValidator(announcementFields);

module.exports = { createAnnouncementSchema, updateAnnouncementSchema };
