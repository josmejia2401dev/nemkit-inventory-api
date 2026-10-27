'use strict';

const { ACCOUNT_TYPE } = require('./users.constants');

function resolveAccountType(user) {
  if (user.accountType && Object.values(ACCOUNT_TYPE).includes(user.accountType)) return user.accountType;
  if (user.employeeId != null) return ACCOUNT_TYPE.EMPLOYEE;
  if (user.roles?.includes('SUPERADMIN')) return ACCOUNT_TYPE.SUPERADMIN;
  return ACCOUNT_TYPE.COMPANY_OWNER;
}

function presentPlatformUser(user, companyName = '', companyBusinessType = null) {
  if (!user) return null;
  const accountType = resolveAccountType(user);
  const isSuperAdmin = accountType === ACCOUNT_TYPE.SUPERADMIN || user.roles?.includes('SUPERADMIN');
  const accountLabel = accountType === ACCOUNT_TYPE.COMPANY_OWNER && isSuperAdmin
    ? 'Titular de empresa · Superadministrador'
    : {
      [ACCOUNT_TYPE.COMPANY_OWNER]: 'Titular de empresa',
      [ACCOUNT_TYPE.EMPLOYEE]: 'Empleado asociado',
      [ACCOUNT_TYPE.UNASSIGNED_EMPLOYEE]: 'Empleado sin asociación',
      [ACCOUNT_TYPE.SUPERADMIN]: 'Superadministrador',
    }[accountType];
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    roles: user.roles ?? [],
    tenantId: user.tenantId ?? null,
    companyName: companyName || user.companyName || '',
    businessType: accountType === ACCOUNT_TYPE.EMPLOYEE
      ? companyBusinessType ?? user.businessType ?? 'retail'
      : user.businessType ?? 'retail',
    employeeId: user.employeeId ?? null,
    accountType,
    accountLabel,
    isOwner: accountType === ACCOUNT_TYPE.COMPANY_OWNER,
    isEmployee: accountType === ACCOUNT_TYPE.EMPLOYEE,
    isUnassigned: accountType === ACCOUNT_TYPE.UNASSIGNED_EMPLOYEE,
    isSuperAdmin,
    recordStatus: user.recordStatus,
    security: {
      lastLoginAt: user.security?.lastLoginAt ?? null,
      lockedUntil: user.security?.lockedUntil ?? null,
      mustChangePassword: user.security?.mustChangePassword ?? false,
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

module.exports = { presentPlatformUser, resolveAccountType };
