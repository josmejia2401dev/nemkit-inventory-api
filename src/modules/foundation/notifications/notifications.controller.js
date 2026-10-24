'use strict';

const { success, paginated } = require('nemkit');
const { notificationsService } = require('./notifications.service');

class NotificationsController {
  async list(req, res, next) {
    try {
      const result = await notificationsService.list(req.user.id, req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      return success(res, await notificationsService.get(req.params.id, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async unreadCount(req, res, next) {
    try {
      return success(res, { unreadCount: await notificationsService.unreadCount(req.user.id) });
    } catch (error) {
      next(error);
    }
  }

  async markRead(req, res, next) {
    try {
      return success(res, await notificationsService.markRead(req.params.id, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req, res, next) {
    try {
      return success(res, await notificationsService.markAllRead(req.user.id));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { NotificationsController, notificationsController: new NotificationsController() };
