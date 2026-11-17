'use strict';

const { PRODUCT_TYPE } = require('../inventory.constants');
const { roundMoney } = require('./pricing');

/**
 * Consumo físico real de stock por producto. En una salida, un plato expande su
 * receta en los insumos; un plato sin receta no mueve existencias.
 */
function buildStockConsumption({ quantities, productById, isOut }) {
  const plan = new Map();
  const add = (productId, quantity) => {
    plan.set(productId, (plan.get(productId) || 0) + quantity);
  };

  for (const [productId, quantity] of quantities) {
    const product = productById.get(productId);
    if (isOut && product.type === PRODUCT_TYPE.PREPARED) {
      for (const ri of product.recipe ?? []) {
        add(ri.ingredientId, ri.quantity * quantity);
      }
    } else {
      add(productId, quantity);
    }
  }

  return plan;
}

function findProduct(productId, productById, ingredientById) {
  return productById.get(productId) || ingredientById.get(productId);
}

/** Primer producto del plan sin stock suficiente, o `null` si la salida es viable. */
function findInsufficientStock({ plan, productById, ingredientById, isOut }) {
  if (!isOut) return null;
  for (const [productId, quantity] of plan) {
    const product = findProduct(productId, productById, ingredientById);
    if ((product?.stock ?? 0) < quantity) return { product, productId };
  }
  return null;
}

/**
 * Líneas del movimiento de inventario. El movimiento refleja el consumo físico
 * (insumos expandidos), no las líneas comerciales del documento.
 */
function buildMovementItems({ plan, productById, ingredientById, items, direction, isOut }) {
  return [...plan.entries()].map(([productId, quantity]) => {
    const product = findProduct(productId, productById, ingredientById);
    const unitCost = roundMoney(
      isOut
        ? (product?.purchasePrice ?? 0)
        : (items.find((item) => item.productId === productId)?.unitCost ?? product?.purchasePrice ?? 0),
    );
    return { productId, quantity, direction, unitCost };
  });
}

module.exports = { buildStockConsumption, findInsufficientStock, buildMovementItems };
