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
    const category = await this.categories.findOne({
      _id: categoryId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });

    if (!category) throw HttpError.badRequest('Invalid or inactive category');

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
      const categoryExists = await this.categories.exists({
        _id: data.categoryId,
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
      });

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
    const usedInRecipe = await this.repository.model.findOne({
      userId,
      type: PRODUCT_TYPE.PREPARED,
      recordStatus: RECORD_STATUS.ACTIVE,
      'recipe.ingredientId': productId,
    }).select('_id name').lean();
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
   * debe existir (tipo ingredient o simple, activo, del mismo tenant) con cantidad
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
    const ingredients = await this.repository.model.find({
      userId,
      _id: { $in: ids },
      type: { $in: [PRODUCT_TYPE.INGREDIENT, PRODUCT_TYPE.SIMPLE] },
      status: PRODUCT_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id').lean();

    if (ingredients.length !== ids.length) {
      throw HttpError.badRequest('One or more recipe ingredients are invalid, inactive or not purchasable');
    }

    return normalized;
  }
}

module.exports = {
  ProductsService,
  productsService: new ProductsService(),
};
