'use strict';

const { getSystemMetrics } = require('nemkit');
const { logsService } = require('../../loggers/logs.service');
const { env } = require('../../../../config/env');

class PlatformOperationsService {
  metrics() {
    return getSystemMetrics({ diskPath: env.LOGS_LOCAL_PATH });
  }

  listLogFiles() {
    return logsService.listFiles();
  }

  readLogs(query) {
    return logsService.read(query);
  }
}

module.exports = { PlatformOperationsService, platformOperationsService: new PlatformOperationsService() };
