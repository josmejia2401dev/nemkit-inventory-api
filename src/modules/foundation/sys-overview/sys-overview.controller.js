'use strict';

const { success } = require('nemkit');
const { platformOverviewService } = require('./sys-overview.service');

class PlatformOverviewController {
  async get(_req, res, next) {
    try {
      return success(res, await platformOverviewService.get());
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { PlatformOverviewController, platformOverviewController: new PlatformOverviewController() };
