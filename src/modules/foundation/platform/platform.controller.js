'use strict';

const { success, paginated, getSystemMetrics } = require('nemkit');
const { platformService } = require('./platform.service');
const { logsService } = require('../loggers/logs.service');
const { env } = require('../../../config/env');

class PlatformController {
  async overview(_req, res, next) {
    try {
      const data = await platformService.overview();
      return success(res, data);
    } catch (error) { next(error); }
  }

  async listUsers(req, res, next) {
    try {
      const result = await platformService.listUsers(req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) { next(error); }
  }

  async getUser(req, res, next) {
    try {
      return success(res, await platformService.getUser(req.params.id));
    } catch (error) { next(error); }
  }

  async listCompanies(req, res, next) {
    try {
      const result = await platformService.listCompanies(req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) { next(error); }
  }

  async getCompany(req, res, next) {
    try {
      return success(res, await platformService.getCompany(req.params.id));
    } catch (error) { next(error); }
  }

  // ── Operación / observabilidad ────────────────────────────────────────
  metrics(_req, res, next) {
    try {
      return success(res, getSystemMetrics({ diskPath: env.LOGS_LOCAL_PATH }));
    } catch (error) { next(error); }
  }

  listLogFiles(_req, res, next) {
    try {
      return success(res, logsService.listFiles());
    } catch (error) { next(error); }
  }

  async readLogs(req, res, next) {
    try {
      return success(res, await logsService.read(req.query));
    } catch (error) { next(error); }
  }
}

module.exports = { PlatformController, platformController: new PlatformController() };
