'use strict';

const { withTimeout } = require('../shared/db');

/** Movimientos paginados con nombre y SKU de cada producto. */
async function movementsReport(models, userId, filter, { page, limit }) {
  const { Movement, Product } = models;
  const [documents, total] = await Promise.all([
    withTimeout(Movement.find(filter).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()),
    withTimeout(Movement.countDocuments(filter)),
  ]);
  const productIds = [...new Set(documents.flatMap((movement) => movement.items.map((item) => item.productId)))];
  const products = productIds.length
    ? await withTimeout(Product.find({ userId, _id: { $in: productIds } }).select('_id name sku').lean())
    : [];
  const productById = new Map(products.map((product) => [product._id, product]));
  return {
    data: documents.map(({ _id, userId: _userId, ...movement }) => ({
      id: _id,
      ...movement,
      items: movement.items.map((item) => ({
        ...item,
        name: productById.get(item.productId)?.name || `Producto #${item.productId}`,
        sku: productById.get(item.productId)?.sku || '',
      })),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

module.exports = { movementsReport };
