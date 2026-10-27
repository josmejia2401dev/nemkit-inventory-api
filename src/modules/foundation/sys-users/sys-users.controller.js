'use strict';

const { success, paginated } = require('nemkit');
const { platformUsersService } = require('./sys-users.service');
const { listQuerySchema, userIdSchema } = require('./sys-users.validator');

function check(schema, data, req, res) {
  const result = schema.check(data ?? {}, req);
  if (result.errorResponse) {
    res.status(400).json(result.errorResponse);
    return null;
  }
  return result.sanitized;
}

class PlatformUsersController {
  async list(req, res, next) {
    try {
      const query = check(listQuerySchema, req.query, req, res);
      if (!query) return;
      const result = await platformUsersService.list(query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const params = check(userIdSchema, req.params, req, res);
      if (!params) return;
      return success(res, await platformUsersService.get(params.id));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { PlatformUsersController, platformUsersController: new PlatformUsersController() };
