'use strict';

/**
 * Matriz central de autorización por rol para el dominio de inventario.
 *
 * Fuente única de verdad: el frontend oculta rutas por UX, pero AQUÍ se decide
 * el acceso real. Cada entrada define qué roles (de usuario, en MAYÚSCULAS como
 * en el JWT) pueden acceder a un grupo de rutas y, cuando aplica, se separa
 * lectura (GET) de escritura (POST/PUT/DELETE).
 *
 * ADMIN tiene acceso total a los datos operativos de su tenant. SUPERADMIN
 * administra la plataforma mediante /platform, con un alcance global distinto.
 */

const ALL = 'ALL'; // marcador: todos los roles autenticados del tenant

/**
 * Para cada recurso montado en el router:
 * - read:  roles que pueden GET
 * - write: roles que pueden POST/PUT/DELETE/PATCH
 * Si un método no aplica a un recurso (p. ej. sólo lectura), write queda vacío.
 */
const PERMISSIONS = Object.freeze({
  products: {
    read: ['WAREHOUSE', 'CASHIER', 'SELLER', 'WAITER'],
    write: ['WAREHOUSE'],
  },
  categories: {
    read: ['WAREHOUSE', 'CASHIER', 'SELLER', 'WAITER'],
    write: ['WAREHOUSE'],
  },
  movements: {
    read: ['WAREHOUSE'],
    write: ['WAREHOUSE'],
  },
  purchases: {
    read: ['WAREHOUSE'],
    write: ['WAREHOUSE'],
  },
  suppliers: {
    read: ['WAREHOUSE'],
    write: ['WAREHOUSE'],
  },
  sales: {
    read: ['CASHIER', 'SELLER', 'WAITER'],
    write: ['CASHIER', 'SELLER', 'WAITER'],
  },
  customers: {
    read: ['CASHIER', 'SELLER', 'WAITER', 'COURIER'],
    write: ['CASHIER', 'SELLER', 'WAITER'],
  },
  deliveries: {
    read: ['CASHIER', 'SELLER', 'WAITER', 'COURIER'],
    write: ['CASHIER', 'SELLER', 'WAITER', 'COURIER'],
  },
  employees: {
    read: [],
    write: [],
  },
  // Consulta ligera de empleados para selectores de venta/entrega (no es gestión).
  'employee-options': {
    read: ['CASHIER', 'SELLER', 'WAITER'],
    write: [],
  },
  // Cola de cocina (restaurante): la ve/gestiona cocina, meseros y caja.
  kitchen: {
    read: ['COOK', 'WAITER', 'CASHIER', 'SELLER'],
    write: ['COOK', 'WAITER', 'CASHIER', 'SELLER'],
  },
  // Mesas (restaurante): leen meseros/caja (elegir mesa, ver ocupación); gestiona admin.
  tables: {
    read: ['WAITER', 'CASHIER', 'SELLER', 'COOK'],
    write: [], // crear/editar/borrar queda a ADMIN vía requireRole en las rutas
  },
  reports: {
    read: [],
    write: [],
  },
  dashboard: {
    read: ALL, // cualquier usuario autenticado ve su dashboard (el contenido ya está acotado por rol/tenant)
    write: [],
  },
});

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PRIVILEGED_ROLES = ['ADMIN'];

/**
 * Crea un middleware de autorización para un recurso, respetando lectura vs escritura.
 * ADMIN siempre pasa. SUPERADMIN solo entra a endpoints de plataforma explícitos.
 *
 * @param {string} resource - clave en PERMISSIONS
 */
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
