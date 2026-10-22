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
  DAMAGE: 'damage',
  LOSS: 'loss',
  INTERNAL_USE: 'internal_use',
});

/** Sentido del cambio de stock por artículo del movimiento. */
const MOVEMENT_DIRECTION = Object.freeze({
  IN: 'in',
  OUT: 'out',
});

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
};
