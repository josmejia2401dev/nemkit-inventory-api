'use strict';

const { usersService } = require('../users/users.service');
const { paginationOptions } = require('../query.utils');
const { presentPlatformUser } = require('../users/users.presenter');

class PlatformUsersService {
  async list(query = {}) {
    const { page, limit, search } = paginationOptions(query);
    const role = typeof query.role === 'string' && query.role.trim() ? query.role.trim().toUpperCase() : null;
    const kinds = ['owner', 'employee', 'unassigned_employee', 'super_admin'];
    const kind = kinds.includes(query.kind) ? query.kind : null;
    const result = await usersService.listGlobal({ page, limit, search, role, kind });
    const tenantIds = [...new Set(result.data
      .map((user) => user.tenantId)
      .filter((tenantId) => tenantId != null))];
    const companies = await usersService.findByIds(tenantIds);
    const companiesById = new Map(companies.map((company) => [company.id, company]));
    const data = result.data.map((user) => presentPlatformUser(
      user,
      user.employeeId != null
        ? companiesById.get(user.tenantId)?.companyName || companiesById.get(user.tenantId)?.fullName || ''
        : '',
      user.employeeId != null ? companiesById.get(user.tenantId)?.businessType ?? null : null,
    ));
    return { data, pagination: result.pagination };
  }

  async get(id) {
    const user = await usersService.getById(id);
    const company = user.tenantId != null && user.employeeId != null
      ? (await usersService.findByIds([user.tenantId]))[0]
      : null;
    const result = presentPlatformUser(
      user,
      company?.companyName || company?.fullName || '',
      company?.businessType ?? null,
    );
    if (result.isOwner) {
      const employees = await usersService.listEmployeesOfTenant(user.id);
      result.employees = employees.map((employee) => presentPlatformUser(
        employee,
        user.companyName || user.fullName,
        user.businessType ?? 'retail',
      ));
    }
    return result;
  }
}

module.exports = { PlatformUsersService, platformUsersService: new PlatformUsersService() };
