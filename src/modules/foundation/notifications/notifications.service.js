'use strict';

const { BaseService, HttpError, RECORD_STATUS } = require('nemkit');
const { NotificationsRepository } = require('./notifications.repository');
const { announcementsService } = require('../announcements/announcements.service');

class NotificationsService extends BaseService {
  constructor() {
    super(new NotificationsRepository());
    this.notFoundMessage = 'Notification not found';
  }

  async list(userId, query = {}) {
    const page = this.#queryInteger(query.page, 1, 1, 1000000, 'page');
    const limit = this.#queryInteger(query.limit, 20, 1, 100, 'limit');
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    if (query.unreadOnly !== undefined) {
      if (!['true', 'false', true, false].includes(query.unreadOnly)) {
        throw HttpError.badRequest('unreadOnly must be a boolean');
      }
      if (query.unreadOnly === true || query.unreadOnly === 'true') filter.readAt = null;
    }
    return this.filterAndPaginate(filter, { page, limit, sort: { deliveredAt: -1, _id: -1 } });
  }

  unreadCount(userId) {
    return this.repository.countUnread(userId);
  }

  async get(id, userId) {
    const notificationId = this.#positiveId(id);
    const notification = await this.findOne({
      _id: notificationId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });
    if (!notification) throw HttpError.notFound('Notification not found');

    const announcement = await announcementsService.getPublished(notification.announcementId);
    const readNotification = await this.markRead(notificationId, userId);
    return { ...readNotification, announcement };
  }

  async markRead(id, userId) {
    const notificationId = this.#positiveId(id);
    const updated = await this.repository.markRead(notificationId, userId, new Date());
    if (updated) return updated;

    const existing = await this.findOne({
      _id: notificationId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });
    if (!existing) throw HttpError.notFound('Notification not found');
    return existing;
  }

  async markAllRead(userId) {
    const result = await this.repository.markAllRead(userId, new Date());
    return { modifiedCount: result.modifiedCount };
  }

  #positiveId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) throw HttpError.badRequest('id must be a positive integer');
    return id;
  }

  #queryInteger(value, fallback, min, max, name) {
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
      throw HttpError.badRequest(`${name} must be an integer between ${min} and ${max}`);
    }
    return parsed;
  }
}

module.exports = { NotificationsService, notificationsService: new NotificationsService() };
