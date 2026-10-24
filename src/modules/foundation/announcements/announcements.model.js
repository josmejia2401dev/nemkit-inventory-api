'use strict';

const { mongoose, applyPlatformSchema, RECORD_STATUS } = require('nemkit');
const {
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_STATUS,
} = require('./announcements.constants');

const AnnouncementSchema = applyPlatformSchema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  slug: { type: String, required: true, trim: true, maxlength: 200 },
  summary: { type: String, required: true, trim: true, maxlength: 300 },
  content: { type: String, required: true, trim: true, maxlength: 12000 },
  category: { type: String, enum: ANNOUNCEMENT_CATEGORIES, required: true },
  status: { type: String, enum: ANNOUNCEMENT_STATUSES, default: ANNOUNCEMENT_STATUS.DRAFT, index: true },
  publishedAt: { type: Date, default: null },
  publishingAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null },
  recipientCount: { type: Number, default: 0, min: 0 },
});

AnnouncementSchema.index({ slug: 1 }, {
  unique: true,
  partialFilterExpression: {
    recordStatus: { $in: [RECORD_STATUS.ACTIVE, RECORD_STATUS.INACTIVE, RECORD_STATUS.ARCHIVED] },
  },
});
AnnouncementSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('foundation_announcements', AnnouncementSchema);
