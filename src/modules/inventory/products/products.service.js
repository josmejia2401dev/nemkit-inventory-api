'use strict';

const { BaseService, HttpError, RECORD_STATUS } = require('nemkit');
const { ProductsRepository } = require('./products.repository');
const { limitsService } = require('../../../config/foundation-services.js');
const {
  pagination,
  positiveInteger,
  escapeRegex,
  assertNoEmptyUpdate,
  validateProductFields,
  translateDuplicateKey,
} = require('../validation');
const {
  PRODUCT_STATUS,
  PRODUCT_STATUSES,
  PRODUCT_TYPE,
  PRODUCT_TYPES,
  STOCK_STATE,
  STOCK_STATES,
} = require('../inventory.constants');

class ProductsService extends BaseService {
  constructor() {
    super(new ProductsRepository());
  }

  getCategoryService() {
    return require('../categories/categories.service').categoriesService;
  }

  findSummariesByIds(userId, productIds) {
    return this.repository.findSummariesByIds(userId, productIds);
  }

  findActiveForStockChange(userId, productIds, session = null) {
    return this.repository.findActiveForStockChange(userId, productIds, session);
  }

  findSaleReversalDetails(userId, productIds, session = null) {
    return this.repository.findSaleReversalDetails(userId, productIds, session);
  }

  changeStock(userId, productId, quantity, direction, session = null) {
    return this.repository.changeStock(userId, productId, quantity, direction, session);
  }

  restoreStock(userId, productId, quantity, session = null) {
    return this.repository.restoreStock(userId, productId, quantity, session);
  }

  hasCategoryReferences(userId, categoryId) {
    return this.repository.hasCategoryReferences(userId, categoryId);
  }

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);
    const { search, categoryId, status, stockState } = query;
    const filter = {
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    };

    if (categoryId !== undefined) {
      filter.categoryId = positiveInteger(categoryId, 'categoryId');
    }

    if (query.productId !== undefined) {
      filter._id = positiveInteger(query.productId, 'productId');
    }

    if (query.type !== undefined) {
      if (!PRODUCT_TYPES.includes(query.type)) {
        throw HttpError.badRequest(`type must be one of: ${PRODUCT_TYPES.join(', ')}`);
      }
      filter.type = query.type;
    }

    // Filtro por conjunto de tipos (p. ej. selector de ventas: simple+prepared).
    if (query.types !== undefined) {
      const list = String(query.types).split(',').map((t) => t.trim()).filter(Boolean);
      if (list.some((t) => !PRODUCT_TYPES.includes(t))) {
        throw HttpError.badRequest(`types must be a subset of: ${PRODUCT_TYPES.join(', ')}`);
      }
      if (list.length) filter.type = { $in: list };
    }

    if (status && !PRODUCT_STATUSES.includes(status)) {
      throw HttpError.badRequest(`status must be ${PRODUCT_STATUSES.join(' or ')}`);
    }

    if (status) filter.status = status;

    if (stockState && !STOCK_STATES.includes(stockState)) {
      throw HttpError.badRequest(`stockState must be ${STOCK_STATES.join(' or ')}`);
    }

    if (stockState) {
      if (status && status !== PRODUCT_STATUS.ACTIVE) {
        throw HttpError.badRequest('stockState can only be used with active products');
      }

      filter.status = PRODUCT_STATUS.ACTIVE;

      if (stockState === STOCK_STATE.OUT_OF_STOCK) {
        filter.stock = 0;
      } else if (stockState === STOCK_STATE.LOW_STOCK) {
        filter.$expr = {
          $and: [
            { $gt: ['$stock', 0] },
            { $lte: ['$stock', '$minimumStock'] },
          ],
        };
      }
    }

    if (search !== undefined && (typeof search !== 'string' || search.length > 100)) {
      throw HttpError.badRequest('search must be a string of at most 100 characters');
    }

    const searchFilter = search
      ? { value: escapeRegex(search), fields: ['name', 'sku', 'barcode'] }
      : null;

    return this.filterAndPaginate(filter, {
      page,
      limit,
      search: searchFilter,
    });
  }

  /**
   * Lookup exacto por código de barras. Se usa al escanear: devuelve el
   * producto activo del tenant o 404 para que el frontend ofrezca crearlo.
   */
  async getByBarcode(barcode, userId) {
    if (typeof barcode !== 'string') {
      throw HttpError.badRequest('barcode must be a string');
    }

    const value = barcode.trim();
    if (!value || value.length > 64) {
      throw HttpError.badRequest('barcode must be between 1 and 64 characters');
    }

    const product = await this.repository.findActiveByBarcode(userId, value);
    if (!product) throw HttpError.notFound('Product not found');
    // El repositorio devuelve el documento crudo de Mongo; se normaliza `_id`
    // para que la respuesta use `id` como el resto de endpoints del API.
    const { _id, ...rest } = product;
    return { id: _id, ...rest };
  }

  async getOwned(id, userId) {
    const productId = positiveInteger(id, 'productId');
    const product = await this.findOne({
      _id: productId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });

    if (!product) throw HttpError.notFound('Product not found');
    return product;
  }

  async create(data, userId) {
    validateProductFields(data);
    const type = this.#validateType(data.type);
    const categoryId = positiveInteger(data.categoryId, 'categoryId');
    const categories = await this.getCategoryService();
    if (!await categories.existsActive(categoryId, userId)) {
      throw HttpError.badRequest('Invalid or inactive category');
    }

    await limitsService.assertCanCreate(userId, 'products');

    try {
      return await this.repository.create({
        ...data,
        type,
        categoryId,
        userId,
        stock: 0,
        // Precio de compra opcional: si no viene, queda en 0.
        purchasePrice: data.purchasePrice ?? 0,
      }, userId);
    } catch (error) {
      return translateDuplicateKey(error);
    }
  }

  async update(id, data, userId) {
    validateProductFields(data);
    const productId = positiveInteger(id, 'productId');
    const current = await this.getOwned(productId, userId);

    assertNoEmptyUpdate(data, [
      'categoryId',
      'type',
      'sku',
      'barcode',
      'name',
      'description',
      'purchasePrice',
      'salePrice',
      'minimumStock',
      'status',
      'image',
    ]);

    if (data.categoryId !== undefined) {
      data.categoryId = positiveInteger(data.categoryId, 'categoryId');
      const categories = await this.getCategoryService();
      const categoryExists = await categories.existsActive(data.categoryId, userId);

      if (!categoryExists) throw HttpError.badRequest('Invalid or inactive category');
    }

    if (data.type !== undefined) {
      data.type = this.#validateType(data.type);
    }

    const { userId: _userId, stock: _stock, ...safeData } = data;

    try {
      return await this.updateById(productId, safeData, userId);
    } catch (error) {
      return translateDuplicateKey(error);
    }
  }

  async remove(id, userId) {
    const productId = positiveInteger(id, 'productId');
    const product = await this.getOwned(productId, userId);

    if (product.stock > 0) {
      throw HttpError.conflict('Record an outbound movement before deleting a product with stock');
    }

    return this.softDelete(productId, userId);
  }

  #validateType(type) {
    if (type === undefined || type === null || type === '') return PRODUCT_TYPE.SIMPLE;
    if (!PRODUCT_TYPES.includes(type)) {
      throw HttpError.badRequest(`type must be one of: ${PRODUCT_TYPES.join(', ')}`);
    }
    return type;
  }

}

module.exports = {
  ProductsService,
  productsService: new ProductsService(),
};
