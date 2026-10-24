'use strict';
const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Product = require('./products.model');
const { PRODUCT_STATUS, PRODUCT_TYPE, MOVEMENT_DIRECTION } = require('../inventory.constants');
const { applyMongoTimeout } = require('../../../config/mongo-query');

class ProductsRepository extends MongoRepository {
  constructor() {
    super(Product);
  }

  hasCategoryReferences(userId, categoryId) {
    return this._applyTimeout(this.model.exists({ userId, categoryId }));
  }

  findActiveRecipeReference(userId, ingredientId) {
    return this._applyTimeout(this.model.findOne({
      userId,
      type: PRODUCT_TYPE.PREPARED,
      recordStatus: RECORD_STATUS.ACTIVE,
      'recipe.ingredientId': ingredientId,
    }).select('_id name').lean());
  }

  findSummariesByIds(userId, productIds) {
    return this._applyTimeout(this.model.find({ userId, _id: { $in: productIds } })
      .select('_id name sku')
      .lean());
  }

  findActiveSummariesByIds(userId, productIds) {
    return this._applyTimeout(this.model.find({
      userId,
      _id: { $in: productIds },
      status: PRODUCT_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id name sku').lean());
  }

  async dashboardSummary(userId) {
    const physicalProductFilter = {
      userId,
      type: { $ne: PRODUCT_TYPE.PREPARED },
      recordStatus: RECORD_STATUS.ACTIVE,
    };
    const alertFilter = {
      ...physicalProductFilter,
      status: PRODUCT_STATUS.ACTIVE,
    };

    const [totalProducts, outOfStock, lowStock, value] = await Promise.all([
      this._applyTimeout(this.model.countDocuments({ ...alertFilter })),
      this._applyTimeout(this.model.countDocuments({ ...alertFilter, stock: 0 })),
      this._applyTimeout(this.model.countDocuments({
        ...alertFilter,
        $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$minimumStock'] }] },
      })),
      applyMongoTimeout(this.model.aggregate([
        { $match: physicalProductFilter },
        { $group: { _id: null, value: { $sum: { $multiply: ['$stock', '$purchasePrice'] } } } },
      ]), this.queryTimeoutMs),
    ]);

    return {
      totalProducts,
      outOfStock,
      lowStock,
      inventoryValue: value[0]?.value || 0,
    };
  }

  findStockAlertDetails(userId) {
    return this._applyTimeout(this.model.find({
      userId,
      status: PRODUCT_STATUS.ACTIVE,
      type: { $ne: PRODUCT_TYPE.PREPARED },
      recordStatus: RECORD_STATUS.ACTIVE,
      $or: [
        { stock: 0 },
        { $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$minimumStock'] }] } },
      ],
    }).select('_id name sku stock minimumStock categoryId').sort({ stock: 1, name: 1 }).lean());
  }

  listInventoryReport(userId) {
    return this._applyTimeout(this.model.find({
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      type: { $ne: PRODUCT_TYPE.PREPARED },
    }).select('_id sku name categoryId purchasePrice salePrice stock minimumStock status')
      .sort({ name: 1 })
      .lean());
  }

  findActiveForStockChange(userId, productIds, session = null) {
    let query = this.model.find({
      userId,
      _id: { $in: productIds },
      status: PRODUCT_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    });

    if (session) query = query.session(session);

    return query.lean();
  }

  findSaleReversalDetails(userId, productIds, session = null) {
    let query = this.model.find({ userId, _id: { $in: productIds } })
      .select('_id type recipe purchasePrice name');
    if (session) query = query.session(session);
    return query.lean();
  }

  changeStock(userId, productId, quantity, direction, session = null) {
    const filter = {
      _id: productId,
      userId,
      status: PRODUCT_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    };
    if (direction === MOVEMENT_DIRECTION.OUT) filter.stock = { $gte: quantity };

    return this._applyTimeout(this.model.updateOne(
      filter,
      { $inc: { stock: direction === MOVEMENT_DIRECTION.IN ? quantity : -quantity } },
      session ? { session } : {},
    ));
  }

  restoreStock(userId, productId, quantity, session = null) {
    return this._applyTimeout(this.model.updateOne(
      { _id: productId, userId },
      { $inc: { stock: quantity } },
      session ? { session } : {},
    ));
  }

  findActiveIngredients(userId, productIds, session = null) {
    let query = this.model.find({
      userId,
      _id: { $in: productIds },
      type: { $in: [PRODUCT_TYPE.INGREDIENT, PRODUCT_TYPE.SIMPLE] },
      status: PRODUCT_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id');

    if (session) query = query.session(session);

    return this._applyTimeout(query.lean());
  }
}

module.exports = { ProductsRepository };
