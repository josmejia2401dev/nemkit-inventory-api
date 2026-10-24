'use strict';

const ACCOUNT_TYPE = Object.freeze({
  COMPANY_OWNER: 'company_owner',
  EMPLOYEE: 'employee',
  UNASSIGNED_EMPLOYEE: 'unassigned_employee',
  SUPERADMIN: 'super_admin',
});

const ACCOUNT_TYPES = Object.freeze(Object.values(ACCOUNT_TYPE));

module.exports = { ACCOUNT_TYPE, ACCOUNT_TYPES };
