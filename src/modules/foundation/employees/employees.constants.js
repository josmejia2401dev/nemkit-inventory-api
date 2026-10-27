'use strict';

/**
 * Cargos operativos de un empleado dentro de una empresa. El empleado se
 * autentica contra su propia colección (foundation_employees), pero opera sobre
 * los datos de la empresa (empresa). El cargo define sus permisos (roles de JWT).
 */
const EMPLOYEE_ROLE = Object.freeze({
  ADMIN: 'admin',
  CASHIER: 'cashier',
  SELLER: 'seller',
  COURIER: 'courier',
  WAREHOUSE: 'warehouse',
  WAITER: 'waiter',
  COOK: 'cook',
});

/** Estado de vinculación/actividad del empleado. */
const EMPLOYEE_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

/** Tipos de identificación (Colombia). */
const DOCUMENT_TYPE = Object.freeze({
  CC: 'CC',   // Cédula de ciudadanía
  CE: 'CE',   // Cédula de extranjería
  NIT: 'NIT', // Número de identificación tributaria
  PAS: 'PAS', // Pasaporte
  TI: 'TI',   // Tarjeta de identidad
});

/** Mapeo del cargo del empleado → roles del token (login/permisos). */
const EMPLOYEE_ROLE_TO_USER_ROLES = Object.freeze({
  [EMPLOYEE_ROLE.ADMIN]: ['ADMIN'],
  [EMPLOYEE_ROLE.CASHIER]: ['CASHIER'],
  [EMPLOYEE_ROLE.SELLER]: ['SELLER'],
  [EMPLOYEE_ROLE.COURIER]: ['COURIER'],
  [EMPLOYEE_ROLE.WAREHOUSE]: ['WAREHOUSE'],
  [EMPLOYEE_ROLE.WAITER]: ['WAITER'],
  [EMPLOYEE_ROLE.COOK]: ['COOK'],
});

const EMPLOYEE_ROLES = Object.freeze(Object.values(EMPLOYEE_ROLE));
const EMPLOYEE_STATUSES = Object.freeze(Object.values(EMPLOYEE_STATUS));
const DOCUMENT_TYPES = Object.freeze(Object.values(DOCUMENT_TYPE));

module.exports = {
  EMPLOYEE_ROLE,
  EMPLOYEE_ROLES,
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUSES,
  DOCUMENT_TYPE,
  DOCUMENT_TYPES,
  EMPLOYEE_ROLE_TO_USER_ROLES,
};
