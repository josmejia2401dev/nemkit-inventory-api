'use strict';

const { success, paginated } = require('nemkit');
const { platformCompaniesService } = require('./sys-companies.service');

class PlatformCompaniesController {
  async list(req, res, next) {
    try {
      const result = await platformCompaniesService.list(req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      return success(res, await platformCompaniesService.get(req.params.id));
    } catch (error) {
      next(error);
    }
  }

}

module.exports = { PlatformCompaniesController, platformCompaniesController: new PlatformCompaniesController() };
