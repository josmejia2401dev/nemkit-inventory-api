'use strict';

const { BaseService, HttpError, RECORD_STATUS } = require('nemkit');
const { ProductsRepository } = require('./products.repository');
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

  findActiveSummariesByIds(userId, productIds) {
    return this.repository.findActiveSummariesByIds(userId, productIds);
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

  dashboardSummary(userId) {
    return this.repository.dashboardSummary(userId);
  }

  async stockAlertDetails(userId) {
    const products = await this.repository.findStockAlertDetails(userId);
    const categoryIds = [...new Set(products.map((product) => product.categoryId))];
    const categories = await this.getCategoryService().findNamesByIds(userId, categoryIds);
    const categoryNames = new Map(categories.map((category) => [category._id, category.name]));
    const items = products.map((product) => ({
      id: product._id,
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      minimumStock: product.minimumStock,
      categoryName: categoryNames.get(product.categoryId) || '',
      state: product.stock === 0 ? 'out_of_stock' : 'low_stock',
    }));

    return {
      outOfStock: items.filter((product) => product.state === 'out_of_stock').length,
      lowStock: items.filter((product) => product.state === 'low_stock').length,
      products: items,
    };
  }

  async inventoryReport(userId) {
    const products = await this.repository.listInventoryReport(userId);
    const categoryIds = [...new Set(products.map((product) => product.categoryId))];
    const categories = await this.getCategoryService().findNamesByIds(userId, categoryIds);
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
      inventoryCost: this.#roundMoney(product.stock * product.purchasePrice),
      potentialSales: this.#roundMoney(product.stock * product.salePrice),
    }));

    return {
      generatedAt: new Date(),
      totals: {
        productCount: items.length,
        units: items.reduce((sum, item) => sum + item.stock, 0),
        inventoryCost: this.#roundMoney(items.reduce((sum, item) => sum + item.inventoryCost, 0)),
        potentialSales: this.#roundMoney(items.reduce((sum, item) => sum + item.potentialSales, 0)),
      },
      items,
    };
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

    // La receta es OPCIONAL para los platos: un restaurante pequeño puede no
    // tener medidas exactas. Si se envían insumos se validan; si no, queda vacía
    // (la venta del plato no descontará stock de insumos).
    const recipe = type === PRODUCT_TYPE.PREPARED
      ? await this.#validateRecipe(data.recipe, userId)
      : [];

    try {
      return await this.repository.create({
        ...data,
        type,
        categoryId,
        userId,
        stock: 0,
        // Precio de compra opcional: si no viene, queda en 0.
        purchasePrice: data.purchasePrice ?? 0,
        recipe,
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
      'recipe',
      'image',
    ]);

    if (data.categoryId !== undefined) {
      data.categoryId = positiveInteger(data.categoryId, 'categoryId');
      const categories = await this.getCategoryService();
      const categoryExists = await categories.existsActive(data.categoryId, userId);

      if (!categoryExists) throw HttpError.badRequest('Invalid or inactive category');
    }

    // Tipo efectivo tras la edición (el enviado o el actual).
    const effectiveType = data.type !== undefined
      ? this.#validateType(data.type)
      : current.type;
    if (data.type !== undefined) data.type = effectiveType;

    // La receta solo aplica a platos; se valida si el producto queda como prepared.
    if (effectiveType === PRODUCT_TYPE.PREPARED) {
      const recipeSource = data.recipe !== undefined ? data.recipe : current.recipe;
      data.recipe = await this.#validateRecipe(recipeSource, userId, productId);
    } else if (data.recipe !== undefined || data.type !== undefined) {
      // Si deja de ser prepared, limpiar la receta.
      data.recipe = [];
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

    // No permitir eliminar un insumo que esté en la receta de algún plato activo:
    // dejaría la receta rota y bloquearía la venta de ese plato.
    const usedInRecipe = await this.repository.findActiveRecipeReference(userId, productId);
    if (usedInRecipe) {
      throw HttpError.conflict(`This product is an ingredient of "${usedInRecipe.name}". Remove it from that recipe first.`);
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

  /**
   * Valida la receta de un plato. La receta es OPCIONAL: puede venir vacía o sin
   * definir (el plato se vende sin descontar insumos). Si trae ítems, cada insumo
   * debe existir (tipo ingredient o simple, activo, del mismo empresa) con cantidad
   * positiva. No se permiten sub-recetas (un insumo no puede ser prepared);
   * `selfId` evita que un plato se use a sí mismo como insumo.
   */
  async #validateRecipe(recipe, userId, selfId = null) {
    // Sin receta → válido (plato sin insumos definidos).
    if (recipe === undefined || recipe === null) return [];
    if (!Array.isArray(recipe)) {
      throw HttpError.badRequest('recipe must be an array of ingredients');
    }
    if (recipe.length === 0) return [];
    if (recipe.length > 100) throw HttpError.badRequest('recipe can contain at most 100 ingredients');

    const normalized = recipe.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw HttpError.badRequest('Each recipe item must be an object');
      }
      const allowed = new Set(['ingredientId', 'quantity']);
      if (Object.keys(item).some((key) => !allowed.has(key))) {
        throw HttpError.badRequest('Recipe item contains unsupported fields');
      }
      const ingredientId = positiveInteger(item.ingredientId, 'ingredientId');
      if (selfId != null && ingredientId === positiveInteger(selfId, 'productId')) {
        throw HttpError.badRequest('A product cannot be an ingredient of itself');
      }
      const quantity = item.quantity;
      if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
        throw HttpError.badRequest('recipe quantity must be a positive number');
      }
      return { ingredientId, quantity };
    });

    const ids = [...new Set(normalized.map((item) => item.ingredientId))];
    const ingredients = await this.repository.findActiveIngredients(userId, ids);

    if (ingredients.length !== ids.length) {
      throw HttpError.badRequest('One or more recipe ingredients are invalid, inactive or not purchasable');
    }

    return normalized;
  }

  #roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

module.exports = {
  ProductsService,
  productsService: new ProductsService(),
};
