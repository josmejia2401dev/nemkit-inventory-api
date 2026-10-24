'use strict';

const { BaseService, HttpError, RECORD_STATUS } = require('nemkit');
const { CategoriesRepository } = require('./categories.repository');
const {
  pagination,
  positiveInteger,
  assertNoEmptyUpdate,
  translateDuplicateKey,
} = require('../validation');

class CategoriesService extends BaseService {
  constructor() {
    super(new CategoriesRepository());
  }

  existsActive(id, userId) {
    const categoryId = positiveInteger(id, 'categoryId');
    return this.exists({
      _id: categoryId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });
  }

  findNamesByIds(userId, categoryIds) {
    return this.repository.findNamesByIds(userId, categoryIds);
  }

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);

    return this.filterAndPaginate({
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }, {
      page,
      limit,
      sort: { name: 1 },
    });
  }

  async create(data, userId) {
    try {
      return await this.repository.create({
        ...data,
        nameKey: data.name.toLowerCase(),
        userId,
      }, userId);
    } catch (error) {
      return translateDuplicateKey(error);
    }
  }

  async update(id, data, userId) {
    const categoryId = positiveInteger(id, 'categoryId');
    await this.getOwned(categoryId, userId);
    assertNoEmptyUpdate(data, ['name', 'description']);

    const update = { ...data };
    if (update.name !== undefined) update.nameKey = update.name.toLowerCase();

    try {
      return await this.updateById(categoryId, update, userId);
    } catch (error) {
      return translateDuplicateKey(error);
    }
  }

  async getOwned(id, userId) {
    const categoryId = positiveInteger(id, 'categoryId');
    const category = await this.findOne({
      _id: categoryId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });

    if (!category) throw HttpError.notFound('Category not found');
    return category;
  }

  async remove(id, userId) {
    const categoryId = positiveInteger(id, 'categoryId');
    await this.getOwned(categoryId, userId);

    const { productsService } = require('../products/products.service');
    const hasLinkedProducts = await productsService.hasCategoryReferences(userId, categoryId);

    if (hasLinkedProducts) {
      throw HttpError.conflict('Category still has linked products; preserve the category for inventory history');
    }

    return this.softDelete(categoryId, userId);
  }
}

module.exports = {
  CategoriesService,
  categoriesService: new CategoriesService(),
};
