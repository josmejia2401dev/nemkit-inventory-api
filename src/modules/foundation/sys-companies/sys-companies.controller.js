'use strict';

const { success, paginated } = require('nemkit');
const { platformCompaniesService } = require('./sys-companies.service');
const { listQuerySchema, companyIdSchema } = require('./sys-companies.validator');

function check(schema, data, req, res) {
  const result = schema.check(data ?? {}, req);
  if (result.errorResponse) {
    res.status(400).json(result.errorResponse);
    return null;
  }
  return result.sanitized;
}

class PlatformCompaniesController {
  async list(req, res, next) {
    try {
      const query = check(listQuerySchema, req.query, req, res);
      if (!query) return;
      const result = await platformCompaniesService.list(query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const params = check(companyIdSchema, req.params, req, res);
      if (!params) return;
      return success(res, await platformCompaniesService.get(params.id));
    } catch (error) {
      next(error);
    }
  }

}

module.exports = { PlatformCompaniesController, platformCompaniesController: new PlatformCompaniesController() };
