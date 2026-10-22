'use strict';

const { success } = require('nemkit');
const { logsService } = require('./logs.service');

class LogsController {
  constructor() { this.service = logsService; }

  async listFiles(_req, res, next) {
    try {
      return success(res, this.service.listFiles());
    } catch (err) { next(err); }
  }

  async read(req, res, next) {
    try {
      const result = await this.service.read(req.query);
      return success(res, result);
    } catch (err) { next(err); }
  }
}

module.exports = { LogsController, logsController: new LogsController() };
