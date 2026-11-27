'use strict';

/** Redondeo monetario a dos decimales, estable ante errores de coma flotante. */
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Costo unitario del producto simple. */
function unitCostOf(product) {
  return product.purchasePrice ?? 0;
}

/**
 * Construye las líneas del documento y agrega las cantidades por producto.
 * Es puro: recibe productos ya cargados y solo calcula.
 */
function buildDocumentItems({ items, productById, amountField, isOut }) {
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
      unitCost: isOut ? unitCostOf(product) : unitAmount,
      ...(isOut ? { unitPrice: unitAmount } : {}),
      lineTotal: roundMoney(unitAmount * item.quantity),
    };
  });

  const total = roundMoney(documentItems.reduce((sum, item) => sum + item.lineTotal, 0));
  return { documentItems, quantities, total };
}

module.exports = { roundMoney, unitCostOf, buildDocumentItems };
