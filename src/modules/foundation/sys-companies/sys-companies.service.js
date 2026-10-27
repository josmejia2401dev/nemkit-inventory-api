'use strict';

const { HttpError } = require('nemkit');
const { usersService } = require('../users/users.service');
const { employeesService } = require('../employees/employees.service');
const { paginationOptions } = require('../query.utils');
const { presentPlatformUser } = require('../users/users.presenter');
const { presentEmployee } = require('../employees/employees.presenter');
const { ACCOUNT_TYPE } = require('../users/users.constants');

function positiveInteger(value, field) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw HttpError.badRequest(`${field} must be a positive integer`);
  return n;
}

class PlatformCompaniesService {
  async list(query = {}) {
    const { page, limit, search } = paginationOptions(query);
    const result = await usersService.listOwners({ page, limit, search });
    // Los empleados viven en su propia colección: contamos ahí, no en users.
    const memberCounts = await employeesService.countByUsers(result.data.map((owner) => owner.id));
    const memberCountsByUser = new Map(memberCounts.map((entry) => [entry._id, entry.count]));
    const data = result.data.map((owner) => ({
      id: owner.id,
      companyName: owner.companyName || owner.fullName,
      businessType: owner.businessType ?? 'retail',
      ownerName: owner.fullName,
      ownerEmail: owner.email,
      recordStatus: owner.recordStatus,
      createdAt: owner.createdAt,
      // dueño + empleados
      memberCount: (memberCountsByUser.get(owner.id) ?? 0) + 1,
    }));
    return { data, pagination: result.pagination };
  }

  async get(id) {
    const companyId = positiveInteger(id, 'companyId');
    const owner = await usersService.getById(companyId);
    const isCompanyOwner = owner.accountType === ACCOUNT_TYPE.COMPANY_OWNER
      || (
        owner.accountType == null
        && owner.employeeId == null
        && !owner.roles?.includes('SUPERADMIN')
      );
    if (!isCompanyOwner || (owner.userId ?? owner.id) !== companyId) {
      throw HttpError.badRequest('The given id does not belong to a company owner');
    }
    const companyName = owner.companyName || owner.fullName;
    const businessType = owner.businessType ?? 'retail';
    const employees = await employeesService.listByUser(owner.id, { includeDeleted: true });
    return {
      id: owner.id,
      companyName,
      businessType,
      owner: presentPlatformUser(owner),
      employees: employees.map((employee) => presentEmployee(employee, companyName, businessType)),
      memberCount: employees.length + 1,
    };
  }
}

module.exports = { PlatformCompaniesService, platformCompaniesService: new PlatformCompaniesService() };
