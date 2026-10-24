'use strict';

const { success, paginated } = require('nemkit');
const { platformUsersService } = require('./platform-users.service');

class PlatformUsersController {
  async list(req, res, next) {
    try {
      const result = await platformUsersService.list(req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      return success(res, await platformUsersService.get(req.params.id));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { PlatformUsersController, platformUsersController: new PlatformUsersController() };
