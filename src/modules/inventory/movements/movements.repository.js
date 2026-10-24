'use strict';
const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Movement = require('./movements.model');
const { MOVEMENT_TYPE } = require('../inventory.constants');
const { applyMongoTimeout } = require('../../../config/mongo-query');

class MovementsRepository extends MongoRepository {
  constructor() {
    super(Movement);
  }

  async createInSession(data, session) {
    const [movement] = await this.model.create([data], { session });
    return movement;
  }

  recent(userId, limit = 10) {
    return this._applyTimeout(this.model.find({
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).sort({ date: -1 }).limit(limit).lean());
  }

  topSellingProductUnits(userId, since) {
    return applyMongoTimeout(this.model.aggregate([
      {
        $match: {
          userId,
          type: MOVEMENT_TYPE.SALE,
          date: { $gte: since },
          recordStatus: RECORD_STATUS.ACTIVE,
        },
      },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', unitsSold: { $sum: '$items.quantity' } } },
      { $sort: { unitsSold: -1 } },
      { $limit: 5 },
    ]), this.queryTimeoutMs);
  }

  async listForReport(filter, { page, limit }) {
    const [documents, total] = await Promise.all([
      this._applyTimeout(this.model.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()),
      this._applyTimeout(this.model.countDocuments(filter)),
    ]);

    return { documents, total };
  }
}

module.exports = { MovementsRepository };
