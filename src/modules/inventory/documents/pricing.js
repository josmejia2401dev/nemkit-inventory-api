'use strict';

const { PRODUCT_TYPE } = require('../inventory.constants');

/** Redondeo monetario a dos decimales, estable ante errores de coma flotante. */
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Costo unitario de un producto. Los platos no tienen costo propio: se calcula
 * como la suma del costo de compra de sus insumos según la receta.
 */
function unitCostOf(product, ingredientById) {
  if (product.type === PRODUCT_TYPE.PREPARED) {
    return roundMoney(
      (product.recipe ?? []).reduce((sum, ri) => {
        const ingredient = ingredientById.get(ri.ingredientId);
        return sum + (ingredient ? ingredient.purchasePrice * ri.quantity : 0);
      }, 0),
    );
  }
  return product.purchasePrice;
}

/**
 * Construye las líneas del documento y agrega las cantidades por producto.
 * Es puro: recibe productos ya cargados y solo calcula.
 */
function buildDocumentItems({ items, productById, ingredientById, amountField, isOut }) {
  const quantities = new Map();
  const documentItems = items.map((item) => {
    const product = productById.get(item.productId);
    const unitAmount = item[amountField];
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
    return {
      productId: item.productId,
      sku: product.sku,
      name: product.name,
      quantity: item.quantity,
      unitCost: isOut ? unitCostOf(product, ingredientById) : unitAmount,
      ...(isOut ? { unitPrice: unitAmount } : {}),
      lineTotal: roundMoney(unitAmount * item.quantity),
    };
  });

  const total = roundMoney(documentItems.reduce((sum, item) => sum + item.lineTotal, 0));
  return { documentItems, quantities, total };
}

module.exports = { roundMoney, unitCostOf, buildDocumentItems };
