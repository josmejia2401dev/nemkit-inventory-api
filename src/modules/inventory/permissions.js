'use strict';

/**
 * Matriz central de autorización por rol para Nemkit Inventory (retail).
 *
 * ADMIN tiene acceso total a los datos operativos de su empresa. Los roles
 * operativos son CASHIER, SELLER y COURIER. La gestión de catálogo, compras,
 * reportes y caja queda en ADMIN.
 */

const ALL = 'ALL';

const PERMISSIONS = Object.freeze({
  products: {
    read: ['CASHIER', 'SELLER'],
    write: [],
  },
  categories: {
    read: ['CASHIER', 'SELLER'],
    write: [],
  },
  movements: {
    read: [],
    write: [],
  },
  purchases: {
    read: [],
    write: [],
  },
  suppliers: {
    read: [],
    write: [],
  },
  sales: {
    read: ['CASHIER', 'SELLER'],
    write: ['CASHIER', 'SELLER'],
  },
  layaways: {
    read: ['CASHIER', 'SELLER'],
    write: ['CASHIER', 'SELLER'],
  },
  customers: {
    read: ['CASHIER', 'SELLER', 'COURIER'],
    write: ['CASHIER', 'SELLER'],
  },
  deliveries: {
    read: ['CASHIER', 'SELLER', 'COURIER'],
    write: ['CASHIER', 'SELLER', 'COURIER'],
  },
  employees: {
    read: [],
    write: [],
  },
  'employee-options': {
    read: ['CASHIER', 'SELLER'],
    write: [],
  },
  reports: {
    read: [],
    write: [],
  },
  'cash-withdrawals': {
    read: [],
    write: [],
  },
  dashboard: {
    read: ALL,
    write: [],
  },
});

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PRIVILEGED_ROLES = ['ADMIN'];

function authorizeResource(resource) {
  const rule = PERMISSIONS[resource];
  if (!rule) throw new Error(`permissions: unknown resource '${resource}'`);

  return (req, res, next) => {
    const roles = req.user?.roles ?? [];
    if (PRIVILEGED_ROLES.some((r) => roles.includes(r))) return next();

    const isWrite = WRITE_METHODS.has(req.method);
    const allowed = isWrite ? rule.write : rule.read;

    if (allowed === ALL) return next();
    if (Array.isArray(allowed) && allowed.some((r) => roles.includes(r))) return next();

    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'No tienes permisos para esta acción',
      metadata: { requestId: req.requestId ?? null },
    });
  };
}

module.exports = { PERMISSIONS, authorizeResource };
