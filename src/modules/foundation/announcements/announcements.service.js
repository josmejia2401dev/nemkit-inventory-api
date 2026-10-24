'use strict';

const { BaseService, HttpError, RECORD_STATUS, UniqueNumberUtil } = require('nemkit');
const { AnnouncementsRepository } = require('./announcements.repository');
const { notificationDeliveryService } = require('../notifications/notification-delivery.service');
const { paginationOptions } = require('../query.utils');
const { ANNOUNCEMENT_STATUS, ANNOUNCEMENT_STATUSES } = require('./announcements.constants');

const UPDATE_FIELDS = Object.freeze(['title', 'summary', 'content', 'category', 'expiresAt']);
const PUBLISHING_LOCK_TIMEOUT_MS = 15 * 60 * 1000;

class AnnouncementsService extends BaseService {
  constructor() {
    super(new AnnouncementsRepository());
    this.notFoundMessage = 'Announcement not found';
  }

  async list(query = {}) {
    const { page, limit, search } = paginationOptions(query);
    const filter = { recordStatus: RECORD_STATUS.ACTIVE };
    if (query.status !== undefined) {
      if (!ANNOUNCEMENT_STATUSES.includes(query.status)) {
        throw HttpError.badRequest(`status must be one of: ${ANNOUNCEMENT_STATUSES.join(', ')}`);
      }
      filter.status = query.status;
    }
    return this.filterAndPaginate(filter, {
      page,
      limit,
      search: search ? { value: search, fields: ['title', 'summary', 'slug'] } : null,
      sort: { createdAt: -1 },
    });
  }

  async get(id) {
    const announcementId = this.#positiveId(id);
    const announcement = await this.findOne({ _id: announcementId, recordStatus: RECORD_STATUS.ACTIVE });
    if (!announcement) throw HttpError.notFound('Announcement not found');
    return announcement;
  }

  async getPublished(id) {
    const announcementId = this.#positiveId(id);
    const announcement = await this.findOne({
      _id: announcementId,
      status: { $in: [ANNOUNCEMENT_STATUS.PUBLISHED, ANNOUNCEMENT_STATUS.ARCHIVED] },
      publishedAt: { $ne: null },
      recordStatus: RECORD_STATUS.ACTIVE,
    });
    if (!announcement) throw HttpError.notFound('Announcement not found');
    if (announcement.expiresAt && new Date(announcement.expiresAt) <= new Date()) {
      throw HttpError.notFound('Announcement not found');
    }
    return announcement;
  }

  async create(data, userId) {
    this.#validateExpiry(data.expiresAt);
    const slug = this.#slug(data.title);
    try {
      return await this.repository.create({
        ...data,
        slug: `${slug}-${UniqueNumberUtil.generateRaw()}`,
        status: ANNOUNCEMENT_STATUS.DRAFT,
      }, userId);
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('Announcement slug already exists');
      throw error;
    }
  }

  async update(id, data, userId) {
    const announcement = await this.get(id);
    if (announcement.status !== ANNOUNCEMENT_STATUS.DRAFT) {
      throw HttpError.conflict('Only draft announcements can be edited');
    }
    const keys = Object.keys(data);
    if (!keys.length || keys.some((key) => !UPDATE_FIELDS.includes(key))) {
      throw HttpError.badRequest('Provide valid announcement fields to update');
    }
    this.#validateExpiry(data.expiresAt);
    return this.updateById(announcement.id, data, userId);
  }

  async publish(id, userId) {
    const announcementId = this.#positiveId(id);
    let announcement = await this.get(announcementId);
    if ([ANNOUNCEMENT_STATUS.PUBLISHED, ANNOUNCEMENT_STATUS.ARCHIVED].includes(announcement.status)) {
      throw HttpError.conflict(`Announcement cannot be published from status ${announcement.status}`);
    }
    this.#validateExpiry(announcement.expiresAt);

    if (announcement.status === ANNOUNCEMENT_STATUS.DRAFT) {
      const publishing = await this.repository.startPublishing(announcementId, userId);
      announcement = publishing ? this.repository.normalizeOutput(publishing) : await this.get(announcementId);
    }
    if (announcement.status === ANNOUNCEMENT_STATUS.PUBLISHING
      && announcement.publishingAt
      && new Date(announcement.publishingAt).getTime() < Date.now() - PUBLISHING_LOCK_TIMEOUT_MS) {
      const recovered = await this.repository.recoverStalePublishing(
        announcementId,
        new Date(Date.now() - PUBLISHING_LOCK_TIMEOUT_MS),
        userId,
      );
      if (!recovered) throw HttpError.conflict('Announcement is currently being published');
      announcement = this.repository.normalizeOutput(recovered);
    } else if (announcement.status === ANNOUNCEMENT_STATUS.PUBLISHING) {
      throw HttpError.conflict('Announcement is currently being published');
    }
    if (announcement.status !== ANNOUNCEMENT_STATUS.PUBLISHING) {
      throw HttpError.conflict(`Announcement cannot be published from status ${announcement.status}`);
    }

    try {
      const recipientCount = await notificationDeliveryService.deliverAnnouncement(announcement, userId);
      const published = await this.repository.markPublished(announcementId, recipientCount, userId);
      if (!published) {
        const current = await this.get(announcementId);
        if (current.status === ANNOUNCEMENT_STATUS.PUBLISHED) return current;
        throw HttpError.conflict('Announcement publication state changed');
      }
      return this.repository.normalizeOutput(published);
    } catch (error) {
      await this.repository.resetDraft(announcementId, userId);
      throw error;
    }
  }

  async archive(id, userId) {
    const announcement = await this.get(id);
    if (![ANNOUNCEMENT_STATUS.PUBLISHED, ANNOUNCEMENT_STATUS.DRAFT].includes(announcement.status)) {
      throw HttpError.conflict(`Announcement cannot be archived from status ${announcement.status}`);
    }
    return this.updateById(announcement.id, { status: ANNOUNCEMENT_STATUS.ARCHIVED }, userId);
  }

  #positiveId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id < 1) throw HttpError.badRequest('id must be a positive integer');
    return id;
  }

  #slug(title) {
    const slug = String(title)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 160);
    return slug || 'announcement';
  }

  #validateExpiry(value) {
    if (value !== undefined && value !== null && new Date(value) <= new Date()) {
      throw HttpError.badRequest('expiresAt must be a future date');
    }
  }
}

module.exports = { AnnouncementsService, announcementsService: new AnnouncementsService() };
