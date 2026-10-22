'use strict';

const { BaseService, HttpError, UniqueNumberUtil, RECORD_STATUS } = require('nemkit');
const { MovementsRepository } = require('./movements.repository');
const { ProductsRepository } = require('../products/products.repository');
const { pagination, positiveInteger, parseDate } = require('../validation');
const {
  PRODUCT_STATUS,
  MOVEMENT_TYPE,
  MOVEMENT_TYPES,
  MOVEMENT_DIRECTION,
  MOVEMENT_DIRECTIONS,
} = require('../inventory.constants');

const TYPE_DIRECTIONS = {
  [MOVEMENT_TYPE.PURCHASE]: MOVEMENT_DIRECTION.IN,
  [MOVEMENT_TYPE.SALE]: MOVEMENT_DIRECTION.OUT,
  [MOVEMENT_TYPE.DAMAGE]: MOVEMENT_DIRECTION.OUT,
  [MOVEMENT_TYPE.LOSS]: MOVEMENT_DIRECTION.OUT,
  [MOVEMENT_TYPE.INTERNAL_USE]: MOVEMENT_DIRECTION.OUT,
};

class MovementsService extends BaseService {
  constructor() {
    super(new MovementsRepository());
    this.products = new ProductsRepository();
  }

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);
    const filter = { userId };

    if (query.type) {
      if (!MOVEMENT_TYPES.includes(query.type)) {
        throw HttpError.badRequest('Unsupported movement type filter');
      }

      filter.type = query.type;
    }

    if (query.productId !== undefined) {
      filter['items.productId'] = positiveInteger(query.productId, 'productId');
    }

    const from = parseDate(query.from, 'from');
    const to = parseDate(query.to, 'to');
    if (from && to && from > to) {
      throw HttpError.badRequest('from must be before to');
    }

    const result = await this.filterAndPaginate(filter, {
      page,
      limit,
      between: { field: 'date', from, to },
    });
    const productIds = [...new Set(result.data.flatMap((movement) => movement.items.map((item) => item.productId)))];
    const products = productIds.length
      ? await this.products.model.find({ userId, _id: { $in: productIds } })
        .select('_id name sku')
        .lean()
      : [];
    const productById = new Map(products.map((product) => [product._id, product]));

    return {
      ...result,
      data: result.data.map((movement) => ({
        ...movement,
        items: movement.items.map((item) => ({
          ...item,
          name: productById.get(item.productId)?.name || `Producto #${item.productId}`,
          sku: productById.get(item.productId)?.sku || '',
        })),
      })),
    };
  }

  async create(data, userId) {
    if ([MOVEMENT_TYPE.PURCHASE, MOVEMENT_TYPE.SALE].includes(data.type)) {
      throw HttpError.badRequest('Purchases and sales must be registered through their documents');
    }

    const items = this.#validateItems(data);
    const date = data.date ? parseDate(data.date, 'date') : new Date();
    const totals = new Map();
    const directions = new Map();

    for (const item of items) {
      const hasConflictingDirection = directions.has(item.productId)
        && directions.get(item.productId) !== item.direction;

      if (hasConflictingDirection) {
        throw HttpError.badRequest('A product can only have one direction per movement');
      }

      directions.set(item.productId, item.direction);
      totals.set(item.productId, (totals.get(item.productId) || 0) + item.quantity);
    }

    return this.repository.withTransaction(async (session) => {
      const productIds = [...totals.keys()];
      const products = await this.products.model.find({
        userId,
        _id: { $in: productIds },
        status: PRODUCT_STATUS.ACTIVE,
        recordStatus: RECORD_STATUS.ACTIVE,
      }).session(session).lean();

      if (products.length !== productIds.length) {
        throw HttpError.badRequest('One or more products are invalid or inactive');
      }

      for (const product of products) {
        const quantity = totals.get(product._id);
        const direction = directions.get(product._id);
        if (direction === MOVEMENT_DIRECTION.OUT && product.stock < quantity) {
          throw HttpError.conflict(`Insufficient stock for ${product.name}`);
        }

        const filter = {
          _id: product._id,
          userId,
          status: PRODUCT_STATUS.ACTIVE,
          recordStatus: RECORD_STATUS.ACTIVE,
        };

        if (direction === MOVEMENT_DIRECTION.OUT) {
          filter.stock = { $gte: quantity };
        }

        const result = await this.products.model.updateOne(
          filter,
          { $inc: { stock: direction === MOVEMENT_DIRECTION.IN ? quantity : -quantity } },
          { session },
        );
        if (result.modifiedCount !== 1) {
          throw HttpError.conflict('Stock changed; retry the movement');
        }
      }

      const movementDocuments = [{
        ...data,
        _id: UniqueNumberUtil.generateRaw(),
        date,
        items,
        userId,
        createdBy: userId,
        updatedBy: userId,
      }];
      const [movement] = await this.repository.model.create(movementDocuments, { session });

      return this.repository.normalizeOutput(movement);
    });
  }

  async getOwned(id, userId) {
    const movement = await this.findOne({ _id: id, userId });
    if (!movement) {
      throw HttpError.notFound('Movement not found');
    }

    return movement;
  }

  #validateItems(data) {
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 500) {
      throw HttpError.badRequest('items must contain between 1 and 500 entries');
    }

    const defaultDirection = TYPE_DIRECTIONS[data.type];
    if ([MOVEMENT_TYPE.PURCHASE, MOVEMENT_TYPE.SALE].includes(data.type)) {
      throw HttpError.badRequest('Purchases and sales must be registered through their documents');
    }
    if (!defaultDirection && data.type !== MOVEMENT_TYPE.MANUAL_ADJUSTMENT) {
      throw HttpError.badRequest('Unsupported movement type');
    }

    return data.items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw HttpError.badRequest('Each item must be an object');
      }

      const allowed = new Set(['productId', 'quantity', 'direction', 'unitCost', 'unitPrice']);
      if (Object.keys(item).some((key) => !allowed.has(key))) {
        throw HttpError.badRequest('Movement item contains unsupported fields');
      }

      const productId = positiveInteger(item.productId, 'productId');
      const quantity = positiveInteger(item.quantity, 'quantity');
      const direction = defaultDirection || item.direction;
      if (!MOVEMENT_DIRECTIONS.includes(direction)) {
        throw HttpError.badRequest(`Manual adjustments require direction "${MOVEMENT_DIRECTIONS.join('" or "')}"`);
      }

      if (defaultDirection && item.direction !== undefined && item.direction !== defaultDirection) {
        throw HttpError.badRequest(`Movement type ${data.type} only supports direction "${defaultDirection}"`);
      }

      const result = {
        productId,
        quantity,
        direction,
      };

      for (const field of ['unitCost', 'unitPrice']) {
        if (item[field] !== undefined) {
          const isInvalid = typeof item[field] !== 'number'
            || !Number.isFinite(item[field])
            || item[field] < 0;

          if (isInvalid) {
            throw HttpError.badRequest(`${field} must be a non-negative number`);
          }

          result[field] = item[field];
        }
      }

      return result;
    });
  }
}

module.exports = { MovementsService, movementsService: new MovementsService() };
