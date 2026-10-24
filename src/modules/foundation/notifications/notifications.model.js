'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

const NotificationSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  announcementId: { type: Number, required: true, index: true },
  tenantId: { type: Number, required: true, index: true },
  announcementSnapshot: {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    summary: { type: String, required: true },
    category: { type: String, required: true },
  },
  readAt: { type: Date, default: null, index: true },
  deliveredAt: { type: Date, required: true, default: Date.now },
}, { tenant: true });

NotificationSchema.index({ userId: 1, announcementId: 1 }, { unique: true });
NotificationSchema.index({ userId: 1, readAt: 1, deliveredAt: -1 });

module.exports = mongoose.model('foundation_notifications', NotificationSchema);
