'use strict';

const { BaseService, HttpError, RECORD_STATUS } = require('nemkit');
const { ProductsRepository } = require('./products.repository');
const { CategoriesRepository } = require('../categories/categories.repository');
const {
  pagination,
  positiveInteger,
  escapeRegex,
  assertNoEmptyUpdate,
  validateProductFields,
  translateDuplicateKey,
} = require('../validation');
const { PRODUCT_STATUS, PRODUCT_STATUSES, STOCK_STATE, STOCK_STATES } = require('../inventory.constants');

class ProductsService extends BaseService {
  constructor() {
    super(new ProductsRepository());
    this.categories = new CategoriesRepository();
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
    const categoryId = positiveInteger(data.categoryId, 'categoryId');
    const category = await this.categories.findOne({
      _id: categoryId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });

    if (!category) throw HttpError.badRequest('Invalid or inactive category');

    try {
      return await this.repository.create({
        ...data,
        categoryId,
        userId,
        stock: 0,
      }, userId);
    } catch (error) {
      return translateDuplicateKey(error);
    }
  }

  async update(id, data, userId) {
    validateProductFields(data);
    const productId = positiveInteger(id, 'productId');
    await this.getOwned(productId, userId);

    assertNoEmptyUpdate(data, [
      'categoryId',
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
      const categoryExists = await this.categories.exists({
        _id: data.categoryId,
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
      });

      if (!categoryExists) throw HttpError.badRequest('Invalid or inactive category');
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
}

module.exports = {
  ProductsService,
  productsService: new ProductsService(),
};
