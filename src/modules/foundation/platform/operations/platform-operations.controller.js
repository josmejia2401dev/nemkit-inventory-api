'use strict';

const { success } = require('nemkit');
const { platformOperationsService } = require('./platform-operations.service');

class PlatformOperationsController {
  metrics(_req, res, next) {
    try {
      return success(res, platformOperationsService.metrics());
    } catch (error) {
      next(error);
    }
  }

  listLogFiles(_req, res, next) {
    try {
      return success(res, platformOperationsService.listLogFiles());
    } catch (error) {
      next(error);
    }
  }

  async readLogs(req, res, next) {
    try {
      return success(res, await platformOperationsService.readLogs(req.query));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { PlatformOperationsController, platformOperationsController: new PlatformOperationsController() };
