'use strict';

const { HttpError } = require('nemkit');
const { usersService } = require('../../users/users.service');
const { paginationOptions } = require('../../query.utils');
const { presentPlatformUser } = require('../platform-user.presenter');
const { ACCOUNT_TYPE } = require('../../users/users.constants');

class PlatformCompaniesService {
  async list(query = {}) {
    const { page, limit, search } = paginationOptions(query);
    const result = await usersService.listOwners({ page, limit, search });
    const memberCounts = await usersService.countByTenants(result.data.map((owner) => owner.id));
    const memberCountsByTenant = new Map(memberCounts.map((entry) => [entry._id, entry.count]));
    const data = result.data.map((owner) => ({
      id: owner.id,
      companyName: owner.companyName || owner.fullName,
      businessType: owner.businessType ?? 'retail',
      ownerName: owner.fullName,
      ownerEmail: owner.email,
      recordStatus: owner.recordStatus,
      createdAt: owner.createdAt,
      memberCount: memberCountsByTenant.get(owner.id) ?? 0,
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
    if (!isCompanyOwner || (owner.tenantId ?? owner.id) !== companyId) {
      throw HttpError.badRequest('The given id does not belong to a company owner');
    }
    const employees = await usersService.listEmployeesOfTenant(owner.id);
    return {
      id: owner.id,
      companyName: owner.companyName || owner.fullName,
      businessType: owner.businessType ?? 'retail',
      owner: presentPlatformUser(owner),
      employees: employees.map((employee) => presentPlatformUser(
        employee,
        owner.companyName || owner.fullName,
        owner.businessType ?? 'retail',
      )),
      memberCount: employees.length + 1,
    };
  }

}

module.exports = { PlatformCompaniesService, platformCompaniesService: new PlatformCompaniesService() };
