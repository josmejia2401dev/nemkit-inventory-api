'use strict';

/** Estados de disponibilidad comercial del producto. */
const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

/** Tipos de eventos que modifican existencias. */
const MOVEMENT_TYPE = Object.freeze({
  PURCHASE: 'purchase',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  SALE: 'sale',
  SALE_VOID: 'sale_void',
  DAMAGE: 'damage',
  LOSS: 'loss',
  INTERNAL_USE: 'internal_use',
});

/** Sentido del cambio de stock por artículo del movimiento. */
const MOVEMENT_DIRECTION = Object.freeze({
  IN: 'in',
  OUT: 'out',
});

const MOVEMENT_SOURCE_TYPE = Object.freeze({
  PURCHASE: 'purchase',
  SALE: 'sale',
});

const DOCUMENT_STATUS = Object.freeze({
  COMPLETED: 'completed',
  VOID: 'void',
});

/** Cargos operativos de un empleado dentro de una cuenta/negocio. */
const EMPLOYEE_ROLE = Object.freeze({
  ADMIN: 'admin',
  CASHIER: 'cashier',
  SELLER: 'seller',
  COURIER: 'courier',
  WAREHOUSE: 'warehouse',
  WAITER: 'waiter',
});

/** Tipos de identificación (Colombia). */
const DOCUMENT_TYPE = Object.freeze({
  CC: 'CC',   // Cédula de ciudadanía
  CE: 'CE',   // Cédula de extranjería
  NIT: 'NIT', // Número de identificación tributaria
  PAS: 'PAS', // Pasaporte
  TI: 'TI',   // Tarjeta de identidad
});

/** Estado de vinculación de un empleado. */
const EMPLOYEE_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

/** Estados del ciclo de vida de un domicilio/pedido. */
const DELIVERY_STATUS = Object.freeze({
  PENDING: 'pending',
  PREPARING: 'preparing',
  ON_ROUTE: 'on_route',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

/** Transiciones de estado permitidas. */
const DELIVERY_TRANSITIONS = Object.freeze({
  pending: ['preparing', 'on_route', 'cancelled'],
  preparing: ['on_route', 'cancelled'],
  on_route: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
});

/** Niveles de fidelización del cliente. */
const LOYALTY_TIER = Object.freeze({
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
});

/**
 * Umbrales de fidelización. Se asigna el tier más alto cuyo umbral de monto
 * gastado O de número de compras alcance el cliente. Evaluados de mayor a menor.
 */
const LOYALTY_TIER_RULES = Object.freeze([
  { tier: LOYALTY_TIER.PLATINUM, minSpent: 2000000, minPurchases: 40 },
  { tier: LOYALTY_TIER.GOLD, minSpent: 800000, minPurchases: 15 },
  { tier: LOYALTY_TIER.SILVER, minSpent: 200000, minPurchases: 5 },
  { tier: LOYALTY_TIER.BRONZE, minSpent: 0, minPurchases: 0 },
]);

/**
 * Resuelve el nivel de fidelización según monto gastado y número de compras.
 * @param {number} totalSpent
 * @param {number} purchaseCount
 * @returns {string} tier
 */
function resolveLoyaltyTier(totalSpent = 0, purchaseCount = 0) {
  for (const rule of LOYALTY_TIER_RULES) {
    if (totalSpent >= rule.minSpent || purchaseCount >= rule.minPurchases) {
      return rule.tier;
    }
  }
  return LOYALTY_TIER.BRONZE;
}

/** Mapeo del cargo del empleado → roles del usuario (login/permisos). */
const EMPLOYEE_ROLE_TO_USER_ROLES = Object.freeze({
  [EMPLOYEE_ROLE.ADMIN]: ['ADMIN'],
  [EMPLOYEE_ROLE.CASHIER]: ['CASHIER'],
  [EMPLOYEE_ROLE.SELLER]: ['SELLER'],
  [EMPLOYEE_ROLE.COURIER]: ['COURIER'],
  [EMPLOYEE_ROLE.WAREHOUSE]: ['WAREHOUSE'],
  [EMPLOYEE_ROLE.WAITER]: ['WAITER'],
});

const EMPLOYEE_ROLES = Object.freeze(Object.values(EMPLOYEE_ROLE));
const DOCUMENT_TYPES = Object.freeze(Object.values(DOCUMENT_TYPE));
const EMPLOYEE_STATUSES = Object.freeze(Object.values(EMPLOYEE_STATUS));
const LOYALTY_TIERS = Object.freeze(Object.values(LOYALTY_TIER));
const DELIVERY_STATUSES = Object.freeze(Object.values(DELIVERY_STATUS));
const PRODUCT_STATUSES = Object.freeze(Object.values(PRODUCT_STATUS));
const STOCK_STATE = Object.freeze({
  OUT_OF_STOCK: 'out_of_stock',
  LOW_STOCK: 'low_stock',
});
const STOCK_STATES = Object.freeze(Object.values(STOCK_STATE));
const MOVEMENT_TYPES = Object.freeze(Object.values(MOVEMENT_TYPE));
const MOVEMENT_DIRECTIONS = Object.freeze(Object.values(MOVEMENT_DIRECTION));

module.exports = {
  PRODUCT_STATUS,
  PRODUCT_STATUSES,
  STOCK_STATE,
  STOCK_STATES,
  MOVEMENT_TYPE,
  MOVEMENT_TYPES,
  MOVEMENT_DIRECTION,
  MOVEMENT_DIRECTIONS,
  MOVEMENT_SOURCE_TYPE,
  DOCUMENT_STATUS,
  EMPLOYEE_ROLE,
  EMPLOYEE_ROLES,
  DOCUMENT_TYPE,
  DOCUMENT_TYPES,
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUSES,
  EMPLOYEE_ROLE_TO_USER_ROLES,
  LOYALTY_TIER,
  LOYALTY_TIERS,
  LOYALTY_TIER_RULES,
  resolveLoyaltyTier,
  DELIVERY_STATUS,
  DELIVERY_STATUSES,
  DELIVERY_TRANSITIONS,
};
