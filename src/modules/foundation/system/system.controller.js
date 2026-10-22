'use strict';

const { success, getSystemMetrics } = require('nemkit');
const { env } = require('../../../config/env');

class SystemController {
  getMetrics(_req, res, next) {
    try {
      return success(res, getSystemMetrics({ diskPath: env.LOGS_LOCAL_PATH }));
    } catch (err) { next(err); }
  }
}

module.exports = { SystemController, systemController: new SystemController() };
