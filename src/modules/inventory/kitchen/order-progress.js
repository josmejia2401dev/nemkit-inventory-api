'use strict';

const { ORDER_STATUS } = require('../inventory.constants');

/**
 * Reglas puras del ciclo de pedido (sin base de datos). Es el único lugar
 * donde vive la máquina de estados de preparación y entrega.
 */

/** Avance natural de una comanda en cocina. */
const ALLOWED_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]: Object.freeze([ORDER_STATUS.PREPARING]),
  [ORDER_STATUS.PREPARING]: Object.freeze([ORDER_STATUS.READY]),
  [ORDER_STATUS.READY]: Object.freeze([ORDER_STATUS.DELIVERED]),
});

/** Sello de tiempo que deja cada transición en `kitchenTimeline`. */
const TIMELINE_FIELDS = Object.freeze({
  [ORDER_STATUS.PREPARING]: 'startedAt',
  [ORDER_STATUS.READY]: 'readyAt',
  [ORDER_STATUS.DELIVERED]: 'deliveredAt',
});

/**
 * Estados a los que puede pasar la comanda. Un pedido a domicilio no se marca
 * entregado desde cocina: el reparto lo cierra el módulo de domicilios.
 */
function nextStatusesFor(currentStatus, orderChannel) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (orderChannel === 'delivery' && currentStatus === ORDER_STATUS.READY) {
    return allowed.filter((status) => status !== ORDER_STATUS.DELIVERED);
  }
  return [...allowed];
}

/** Roles que pueden mover una comanda según el tipo de negocio. */
function allowedRoles(businessType) {
  return businessType === 'restaurant'
    ? ['ADMIN', 'SELLER', 'WAITER', 'CASHIER', 'COOK']
    : ['ADMIN', 'SELLER'];
}

/** Campos de `kitchenTimeline` que sella la transición (vacío si no aplica). */
function timelineFor(status, now = new Date()) {
  const field = TIMELINE_FIELDS[status];
  return field ? { [field]: now } : {};
}

module.exports = {
  ALLOWED_TRANSITIONS,
  nextStatusesFor,
  allowedRoles,
  timelineFor,
};
