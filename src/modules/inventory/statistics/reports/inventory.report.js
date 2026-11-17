'use strict';

const { RECORD_STATUS } = require('nemkit');
const { withTimeout } = require('../shared/db');
const { roundMoney } = require('../shared/aggregations');

/** Reporte de existencias: costo y venta potencial por producto. */
async function inventoryReport(models, userId) {
  const { Product, Category } = models;
  const products = await withTimeout(Product.find({ userId, recordStatus: RECORD_STATUS.ACTIVE })
    .select('_id sku name categoryId purchasePrice salePrice stock minimumStock status')
    .sort({ name: 1 })
    .lean());
  const categoryIds = [...new Set(products.map((product) => product.categoryId))];
  const categories = categoryIds.length
    ? await withTimeout(Category.find({ userId, _id: { $in: categoryIds }, recordStatus: RECORD_STATUS.ACTIVE }).select('_id name').lean())
    : [];
  const categoryNames = new Map(categories.map((category) => [category._id, category.name]));
  const items = products.map((product) => ({
    id: product._id,
    sku: product.sku,
    name: product.name,
    categoryName: categoryNames.get(product.categoryId) || 'Sin categoría',
    status: product.status,
    stock: product.stock,
    minimumStock: product.minimumStock,
    purchasePrice: product.purchasePrice,
    salePrice: product.salePrice,
    inventoryCost: roundMoney(product.stock * product.purchasePrice),
    potentialSales: roundMoney(product.stock * product.salePrice),
  }));
  return {
    generatedAt: new Date(),
    totals: {
      productCount: items.length,
      units: items.reduce((sum, item) => sum + item.stock, 0),
      inventoryCost: roundMoney(items.reduce((sum, item) => sum + item.inventoryCost, 0)),
      potentialSales: roundMoney(items.reduce((sum, item) => sum + item.potentialSales, 0)),
    },
    items,
  };
}

module.exports = { inventoryReport };
