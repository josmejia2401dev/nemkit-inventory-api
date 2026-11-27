'use strict';

const { BaseService, HttpError, RECORD_STATUS } = require('nemkit');
const { CategoriesRepository } = require('./categories.repository');
const { cache, CACHE_TTL } = require('../../../config/cache');
const { cacheKeys, invalidateCategories } = require('../cache/cache-keys');
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
    // El catálogo de categorías es pequeño y se usa en selectores: se cachea
    // completo y se pagina en memoria para no crear una clave por filtro.
    const all = await cache.readThrough({
      key: cacheKeys.categoriesAll(userId),
      ttlSeconds: CACHE_TTL.catalog,
      load: () => this.repository.find(
        { userId, recordStatus: RECORD_STATUS.ACTIVE },
        { sort: { name: 1 } },
      ),
    });
    const total = all.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    return {
      data: all.slice(start, start + limit),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async create(data, userId) {
    try {
      const created = await this.repository.create({
        ...data,
        nameKey: data.name.toLowerCase(),
        userId,
      }, userId);
      await invalidateCategories(userId);
      return created;
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
      const updated = await this.updateById(categoryId, update, userId);
      await invalidateCategories(userId);
      return updated;
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

    const removed = await this.softDelete(categoryId, userId);
    await invalidateCategories(userId);
    return removed;
  }
}

module.exports = {
  CategoriesService,
  categoriesService: new CategoriesService(),
};
