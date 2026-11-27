'use strict';

const { success } = require('nemkit');
const { employeesService } = require('../../../config/foundation-services');

class EmployeeOptionsController {
  async options(req, res, next) {
    try {
      return success(res, await employeesService.options(req.user.id, req.query));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { employeeOptionsController: new EmployeeOptionsController() };
