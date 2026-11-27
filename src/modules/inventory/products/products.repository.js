'use strict';
const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Product = require('./products.model');
const { PRODUCT_STATUS, MOVEMENT_DIRECTION } = require('../inventory.constants');

class ProductsRepository extends MongoRepository {
  constructor() {
    super(Product);
  }

  hasCategoryReferences(userId, categoryId) {
    return this._applyTimeout(this.model.exists({ userId, categoryId }));
  }

  findActiveByBarcode(userId, barcode) {
    return this._applyTimeout(this.model.findOne({
      userId,
      barcode,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).lean());
  }

  findSummariesByIds(userId, productIds) {
    return this._applyTimeout(this.model.find({ userId, _id: { $in: productIds } })
      .select('_id name sku')
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
      .select('_id purchasePrice name');
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
}

module.exports = { ProductsRepository };
