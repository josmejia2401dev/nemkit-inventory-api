'use strict';

const { cache } = require('../../../config/cache');

/** Claves explícitas por tenant. No se usa SCAN ni KEYS. */
const cacheKeys = {
  product: (userId, productId) => `${userId}:product:${productId}`,
  productBarcode: (userId, barcode) => `${userId}:product:barcode:${barcode}`,
  categoriesAll: (userId) => `${userId}:categories:all`,
};

async function invalidateProduct(userId, productId, barcodes = []) {
  const keys = [cacheKeys.product(userId, productId)];
  for (const barcode of barcodes) {
    const value = String(barcode ?? '').trim();
    if (value) keys.push(cacheKeys.productBarcode(userId, value));
  }
  await cache.delMany(keys).catch(() => undefined);
}

async function invalidateCategories(userId) {
  await cache.del(cacheKeys.categoriesAll(userId)).catch(() => undefined);
}

module.exports = { cacheKeys, invalidateProduct, invalidateCategories };
