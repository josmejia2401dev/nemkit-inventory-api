'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Notification = require('./notifications.model');

class NotificationsRepository extends MongoRepository {
  constructor() {
    super(Notification);
  }

  createAnnouncementDeliveries(announcement, recipients, createdBy) {
    if (!recipients.length) return Promise.resolve({ upsertedCount: 0 });
    const operations = recipients.map((recipient) => ({
      updateOne: {
        filter: { userId: recipient.id, announcementId: announcement.id },
        update: {
          $setOnInsert: {
            _id: recipient.notificationId,
            userId: recipient.id,
            tenantId: recipient.tenantId,
            announcementId: announcement.id,
            announcementSnapshot: {
              title: announcement.title,
              slug: announcement.slug,
              summary: announcement.summary,
              category: announcement.category,
            },
            readAt: null,
            deliveredAt: new Date(),
            createdBy,
            updatedBy: createdBy,
          },
        },
        upsert: true,
      },
    }));
    return this.model.bulkWrite(operations, { ordered: false });
  }

  markRead(id, userId, readAt) {
    return this._applyTimeout(this.model.findOneAndUpdate(
      { _id: id, userId, recordStatus: RECORD_STATUS.ACTIVE, readAt: null },
      { $set: { readAt, updatedBy: userId } },
      { returnDocument: 'after' },
    ));
  }

  markAllRead(userId, readAt) {
    return this._applyTimeout(this.model.updateMany(
      { userId, recordStatus: RECORD_STATUS.ACTIVE, readAt: null },
      { $set: { readAt, updatedBy: userId } },
    ));
  }

  countUnread(userId) {
    return this.countDocuments({ userId, recordStatus: RECORD_STATUS.ACTIVE, readAt: null });
  }
}

module.exports = { NotificationsRepository };
