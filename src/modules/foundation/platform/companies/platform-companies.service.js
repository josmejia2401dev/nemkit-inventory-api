'use strict';

const { HttpError } = require('nemkit');
const { usersService } = require('../../users/users.service');
const { employeesService } = require('../../employees/employees.service');
const { paginationOptions } = require('../../query.utils');
const { presentPlatformUser } = require('../platform-user.presenter');
const { ACCOUNT_TYPE } = require('../../users/users.constants');

function positiveInteger(value, field) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw HttpError.badRequest(`${field} must be a positive integer`);
  return n;
}

/** Representa un empleado (colección propia) con la forma del panel de plataforma. */
function presentEmployee(employee, companyName, businessType) {
  return {
    id: employee.id ?? employee._id,
    fullName: employee.name,
    email: employee.email,
    roles: [String(employee.role ?? '').toUpperCase()],
    tenantId: employee.tenantId,
    companyName: companyName ?? '',
    businessType: businessType ?? 'retail',
    role: employee.role,
    status: employee.status,
    recordStatus: employee.recordStatus,
    isOwner: false,
    isEmployee: true,
    createdAt: employee.createdAt,
  };
}

class PlatformCompaniesService {
  async list(query = {}) {
    const { page, limit, search } = paginationOptions(query);
    const result = await usersService.listOwners({ page, limit, search });
    // Los empleados viven en su propia colección: contamos ahí, no en users.
    const memberCounts = await employeesService.countByTenants(result.data.map((owner) => owner.id));
    const memberCountsByTenant = new Map(memberCounts.map((entry) => [entry._id, entry.count]));
    const data = result.data.map((owner) => ({
      id: owner.id,
      companyName: owner.companyName || owner.fullName,
      businessType: owner.businessType ?? 'retail',
      ownerName: owner.fullName,
      ownerEmail: owner.email,
      recordStatus: owner.recordStatus,
      createdAt: owner.createdAt,
      // dueño + empleados
      memberCount: (memberCountsByTenant.get(owner.id) ?? 0) + 1,
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
    const companyName = owner.companyName || owner.fullName;
    const businessType = owner.businessType ?? 'retail';
    const employees = await employeesService.listByTenant(owner.id);
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
