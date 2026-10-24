'use strict';

const { success, created, paginated } = require('nemkit');
const { announcementsService } = require('./announcements.service');
const { createAnnouncementSchema, updateAnnouncementSchema } = require('./announcements.validator');

class AnnouncementsController {
  async list(req, res, next) {
    try {
      const result = await announcementsService.list(req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      return success(res, await announcementsService.get(req.params.id));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = createAnnouncementSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(res, await announcementsService.create(sanitized, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { errorResponse, sanitized } = updateAnnouncementSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await announcementsService.update(req.params.id, sanitized, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async publish(req, res, next) {
    try {
      return success(res, await announcementsService.publish(req.params.id, req.user.id), 'Announcement published');
    } catch (error) {
      next(error);
    }
  }

  async archive(req, res, next) {
    try {
      return success(res, await announcementsService.archive(req.params.id, req.user.id), 'Announcement archived');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { AnnouncementsController, announcementsController: new AnnouncementsController() };
