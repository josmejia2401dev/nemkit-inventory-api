'use strict';

/** Estados de disponibilidad comercial del producto. */
const PRODUCT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

/**
 * Naturaleza del producto. Nemkit Inventory solo expone `simple`; los otros
 * tipos se conservan en el código histórico pero no se ofrecen en la UI/API.
 */
const PRODUCT_TYPE = Object.freeze({
  SIMPLE: 'simple',
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
  LAYAWAY_RESERVE: 'layaway_reserve',
  LAYAWAY_RELEASE: 'layaway_release',
});

const MOVEMENT_DIRECTION = Object.freeze({
  IN: 'in',
  OUT: 'out',
});

const MOVEMENT_SOURCE_TYPE = Object.freeze({
  PURCHASE: 'purchase',
  SALE: 'sale',
  LAYAWAY_RESERVE: 'layaway_reserve',
  LAYAWAY_RELEASE: 'layaway_release',
});

const DOCUMENT_STATUS = Object.freeze({
  COMPLETED: 'completed',
  VOID: 'void',
});

/**
 * Ciclo de vida de un pedido retail. No hay preparación: el pedido se crea,
 * sale a ruta si es domicilio y se entrega/cancela.
 */
const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  ON_ROUTE: 'on_route',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

const PAYMENT_STATUS = Object.freeze({
  PAID: 'paid',
  PENDING: 'pending',
});

const LAYAWAY_STATUS = Object.freeze({
  ACTIVE: 'active',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

const LAYAWAY_FREQUENCY = Object.freeze({
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom',
});

const LAYAWAY_PAYMENT_METHOD = Object.freeze({
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer',
  NEQUI: 'nequi',
  DAVIPLATA: 'daviplata',
  OTHER: 'other',
});

const LAYAWAY_HANDOVER_MODE = Object.freeze({
  PICKUP: 'pickup',
  DELIVERY: 'delivery',
  IMMEDIATE: 'immediate',
});

const LAYAWAY_HANDOVER_STATUS = Object.freeze({
  PENDING: 'pending',
  DELIVERED: 'delivered',
});

const LAYAWAY_CANCELLATION_POLICY = Object.freeze({
  REFUND_ALL: 'refund_all',
  RETAIN_PERCENT: 'retain_percent',
  MANUAL: 'manual',
});

const LAYAWAY_RETURN_CONDITION = Object.freeze({
  RESELLABLE: 'resellable',
  DAMAGED: 'damaged',
  NOT_RETURNED: 'not_returned',
});

const LAYAWAY_PAYMENT_TYPE = Object.freeze({
  INITIAL: 'initial',
  INSTALLMENT: 'installment',
});

const LAYAWAY_STATUSES = Object.freeze(Object.values(LAYAWAY_STATUS));
const LAYAWAY_FREQUENCIES = Object.freeze(Object.values(LAYAWAY_FREQUENCY));
const LAYAWAY_PAYMENT_METHODS = Object.freeze(Object.values(LAYAWAY_PAYMENT_METHOD));
const LAYAWAY_HANDOVER_MODES = Object.freeze(Object.values(LAYAWAY_HANDOVER_MODE));
const LAYAWAY_HANDOVER_STATUSES = Object.freeze(Object.values(LAYAWAY_HANDOVER_STATUS));
const LAYAWAY_CANCELLATION_POLICIES = Object.freeze(Object.values(LAYAWAY_CANCELLATION_POLICY));
const LAYAWAY_RETURN_CONDITIONS = Object.freeze(Object.values(LAYAWAY_RETURN_CONDITION));
const LAYAWAY_PAYMENT_TYPES = Object.freeze(Object.values(LAYAWAY_PAYMENT_TYPE));
const LAYAWAY_CANCEL_REASONS = Object.freeze([
  'customer_changed',
  'payment_default',
  'out_of_stock',
  'duplicate',
  'other',
]);
const LAYAWAY_DEFAULT_SETTINGS = Object.freeze({
  minInitialPercent: 0,
  maxTermMonths: 60,
  defaultFrequency: LAYAWAY_FREQUENCY.MONTHLY,
  cancellationPolicy: LAYAWAY_CANCELLATION_POLICY.MANUAL,
  retentionPercent: 0,
  allowImmediateHandover: true,
});

const CANCEL_REASON = Object.freeze({
  CUSTOMER_LEFT: 'customer_left',
  ORDER_ERROR: 'order_error',
  OUT_OF_STOCK: 'out_of_stock',
  CUSTOMER_CHANGED: 'customer_changed',
  OTHER: 'other',
});

/** Cargos operativos de Nemkit Inventory. */
const EMPLOYEE_ROLE = Object.freeze({
  ADMIN: 'admin',
  CASHIER: 'cashier',
  SELLER: 'seller',
  COURIER: 'courier',
});

const BUSINESS_TYPE = Object.freeze({
  RETAIL: 'retail',
  RESTAURANT: 'restaurant',
});

/** Estados logísticos de un domicilio retail. */
const DELIVERY_STATUS = Object.freeze({
  PENDING: ORDER_STATUS.PENDING,
  ON_ROUTE: ORDER_STATUS.ON_ROUTE,
  DELIVERED: ORDER_STATUS.DELIVERED,
  CANCELLED: ORDER_STATUS.CANCELLED,
});

const DELIVERY_TRANSITIONS = Object.freeze({
  pending: ['on_route', 'cancelled'],
  on_route: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
});

const DELIVERY_COURIER_STATUSES = Object.freeze(['on_route', 'delivered', 'cancelled']);

const LOYALTY_TIER = Object.freeze({
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
});

const EMPLOYEE_ROLE_TO_USER_ROLES = Object.freeze({
  [EMPLOYEE_ROLE.ADMIN]: ['ADMIN'],
  [EMPLOYEE_ROLE.CASHIER]: ['CASHIER'],
  [EMPLOYEE_ROLE.SELLER]: ['SELLER'],
  [EMPLOYEE_ROLE.COURIER]: ['COURIER'],
});

const EMPLOYEE_ROLES = Object.freeze(Object.values(EMPLOYEE_ROLE));
const BUSINESS_TYPES = Object.freeze(Object.values(BUSINESS_TYPE));
const PAYMENT_STATUSES = Object.freeze(Object.values(PAYMENT_STATUS));
const CANCEL_REASONS = Object.freeze(Object.values(CANCEL_REASON));
const DELIVERY_STATUSES = Object.freeze(Object.values(DELIVERY_STATUS));
const ORDER_STATUSES = Object.freeze(Object.values(ORDER_STATUS));
const PRODUCT_STATUSES = Object.freeze(Object.values(PRODUCT_STATUS));
const PRODUCT_TYPES = Object.freeze(Object.values(PRODUCT_TYPE));
const PURCHASABLE_TYPES = Object.freeze([PRODUCT_TYPE.SIMPLE]);
const SELLABLE_TYPES = Object.freeze([PRODUCT_TYPE.SIMPLE]);
const STOCK_STATE = Object.freeze({
  OUT_OF_STOCK: 'out_of_stock',
  LOW_STOCK: 'low_stock',
});
const STOCK_STATES = Object.freeze(Object.values(STOCK_STATE));
const MOVEMENT_TYPES = Object.freeze(Object.values(MOVEMENT_TYPE));
const MOVEMENT_DIRECTIONS = Object.freeze(Object.values(MOVEMENT_DIRECTION));
const LOYALTY_TIERS = Object.freeze(Object.values(LOYALTY_TIER));

module.exports = {
  PRODUCT_STATUS,
  PRODUCT_STATUSES,
  PRODUCT_TYPE,
  PRODUCT_TYPES,
  PURCHASABLE_TYPES,
  SELLABLE_TYPES,
  STOCK_STATE,
  STOCK_STATES,
  MOVEMENT_TYPE,
  MOVEMENT_TYPES,
  MOVEMENT_DIRECTION,
  MOVEMENT_DIRECTIONS,
  MOVEMENT_SOURCE_TYPE,
  DOCUMENT_STATUS,
  ORDER_STATUS,
  ORDER_STATUSES,
  PAYMENT_STATUS,
  PAYMENT_STATUSES,
  LAYAWAY_STATUS,
  LAYAWAY_STATUSES,
  LAYAWAY_FREQUENCY,
  LAYAWAY_FREQUENCIES,
  LAYAWAY_PAYMENT_METHOD,
  LAYAWAY_PAYMENT_METHODS,
  LAYAWAY_PAYMENT_TYPE,
  LAYAWAY_PAYMENT_TYPES,
  LAYAWAY_HANDOVER_MODE,
  LAYAWAY_HANDOVER_MODES,
  LAYAWAY_HANDOVER_STATUS,
  LAYAWAY_HANDOVER_STATUSES,
  LAYAWAY_CANCELLATION_POLICY,
  LAYAWAY_CANCELLATION_POLICIES,
  LAYAWAY_RETURN_CONDITION,
  LAYAWAY_RETURN_CONDITIONS,
  LAYAWAY_CANCEL_REASONS,
  LAYAWAY_DEFAULT_SETTINGS,
  CANCEL_REASON,
  CANCEL_REASONS,
  EMPLOYEE_ROLE,
  EMPLOYEE_ROLES,
  EMPLOYEE_ROLE_TO_USER_ROLES,
  BUSINESS_TYPE,
  BUSINESS_TYPES,
  LOYALTY_TIER,
  LOYALTY_TIERS,
  DELIVERY_STATUS,
  DELIVERY_STATUSES,
  DELIVERY_TRANSITIONS,
  DELIVERY_COURIER_STATUSES,
};
