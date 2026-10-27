'use strict';

const { employeesService } = require('../employees/employees.service');
const { usersService } = require('../users/users.service');
const { paginationOptions } = require('../query.utils');
const { presentEmployee } = require('../employees/employees.presenter');

class PlatformEmployeesService {
  async list(query = {}) {
    const { page, limit, search } = paginationOptions(query);
    const result = await employeesService.listGlobal({
      page,
      limit,
      search,
      role: query.role,
      status: query.status,
      recordStatus: query.recordStatus,
    });

    const userIds = [...new Set(result.data.map((employee) => employee.userId))];
    const companies = await usersService.findByIds(userIds);
    const companiesById = new Map(companies.map((company) => [company.id, company]));
    const data = result.data.map((employee) => {
      const company = companiesById.get(employee.userId);
      return presentEmployee(
        employee,
        company?.companyName || company?.fullName,
        company?.businessType ?? 'retail',
      );
    });

    return { data, pagination: result.pagination };
  }
}

module.exports = {
  PlatformEmployeesService,
  platformEmployeesService: new PlatformEmployeesService(),
};
