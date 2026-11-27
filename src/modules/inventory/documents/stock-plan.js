'use strict';

const { roundMoney } = require('./pricing');

/** Consumo físico de stock: cada producto vendido descuenta su propia cantidad. */
function buildStockConsumption({ quantities }) {
  return new Map(quantities);
}

/** Primer producto del plan sin stock suficiente, o `null` si la salida es viable. */
function findInsufficientStock({ plan, productById, isOut }) {
  if (!isOut) return null;
  for (const [productId, quantity] of plan) {
    const product = productById.get(productId);
    if ((product?.stock ?? 0) < quantity) return { product, productId };
  }
  return null;
}

/** Líneas del movimiento de inventario a partir del plan de stock. */
function buildMovementItems({ plan, productById, items, direction, isOut }) {
  return [...plan.entries()].map(([productId, quantity]) => {
    const product = productById.get(productId);
    const unitCost = roundMoney(
      isOut
        ? (product?.purchasePrice ?? 0)
        : (items.find((item) => item.productId === productId)?.unitCost ?? product?.purchasePrice ?? 0),
    );
    return { productId, quantity, direction, unitCost };
  });
}

module.exports = { buildStockConsumption, findInsufficientStock, buildMovementItems };
