'use strict';

const { UniqueNumberUtil } = require('nemkit');
const { usersService } = require('../users/users.service');
const { NotificationsRepository } = require('./notifications.repository');

const BATCH_SIZE = 500;

class NotificationDeliveryService {
  constructor(repository = new NotificationsRepository()) {
    this.repository = repository;
  }

  async deliverAnnouncement(announcement, actorId) {
    let afterId = 0;
    let deliveredCount = 0;

    while (true) {
      const recipients = await usersService.listActiveNotificationRecipientsAfter(afterId, BATCH_SIZE);
      if (recipients.length === 0) break;

      const result = await this.repository.createAnnouncementDeliveries(
        announcement,
        recipients.map((recipient) => ({
          ...recipient,
          notificationId: UniqueNumberUtil.generateRaw(),
        })),
        actorId,
      );
      deliveredCount += (result.upsertedCount ?? 0) + (result.matchedCount ?? 0);
      afterId = recipients[recipients.length - 1].id;
    }

    return deliveredCount;
  }
}

module.exports = {
  NotificationDeliveryService,
  notificationDeliveryService: new NotificationDeliveryService(),
};
