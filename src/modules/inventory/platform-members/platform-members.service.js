'use strict';

const { usersService } = require('../../foundation/users/users.service');
const { employeesService } = require('../employees/employees.service');
const { positiveInteger } = require('../validation');

class PlatformMembersService {
  associate(companyId, email, role, actorId) {
    return employeesService.associateExistingUser(
      email,
      role,
      positiveInteger(companyId, 'companyId'),
      actorId,
    );
  }

  disassociate(companyId, userId, actorId) {
    return employeesService.disassociateUser(
      positiveInteger(userId, 'userId'),
      positiveInteger(companyId, 'companyId'),
      actorId,
    );
  }

  async employmentHistory(userId) {
    const history = await employeesService.listAccountHistory(positiveInteger(userId, 'userId'));
    const companyIds = [...new Set(history.map((entry) => entry.userId))];
    const companies = await usersService.findByIds(companyIds);
    const companyNames = new Map(companies.map((company) => [
      company.id,
      company.companyName || company.fullName,
    ]));

    return history.map((entry) => ({
      employeeId: entry._id,
      companyId: entry.userId,
      companyName: companyNames.get(entry.userId) || 'Empresa no disponible',
      role: entry.role,
      status: entry.status,
      recordStatus: entry.recordStatus,
      associatedAt: entry.createdAt,
      disassociatedAt: entry.disassociatedAt ?? null,
      associatedBy: entry.createdBy ?? null,
      disassociatedBy: entry.disassociatedBy ?? null,
      isCurrent: entry.linkedUserId === Number(userId),
    }));
  }
}

module.exports = {
  PlatformMembersService,
  platformMembersService: new PlatformMembersService(),
};
