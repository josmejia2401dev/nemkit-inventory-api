'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Customer = require('./customers.model');
const { LOYALTY_TIER } = require('../inventory.constants');

class CustomersRepository extends MongoRepository {
  constructor() {
    super(Customer);
  }

  findActiveForDocument(customerId, userId, session = null) {
    let query = this.model.findOne({
      _id: customerId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });

    if (session) query = query.session(session);

    return this._applyTimeout(query.lean());
  }

  updateSaleStats(customerId, userId, stats, session = null) {
    return this._applyTimeout(this.model.updateOne(
      { _id: customerId, userId, recordStatus: RECORD_STATUS.ACTIVE },
      { $set: { ...stats, updatedBy: userId } },
      session ? { session } : {},
    ));
  }

  async dashboardMetrics(userId, since) {
    const baseFilter = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    const [total, newCustomers, frequent, vip] = await Promise.all([
      this._applyTimeout(this.model.countDocuments(baseFilter)),
      this._applyTimeout(this.model.countDocuments({ ...baseFilter, createdAt: { $gte: since } })),
      this._applyTimeout(this.model.countDocuments({ ...baseFilter, 'stats.purchaseCount': { $gte: 5 } })),
      this._applyTimeout(this.model.countDocuments({
        ...baseFilter,
        loyaltyTier: { $in: [LOYALTY_TIER.GOLD, LOYALTY_TIER.PLATINUM] },
      })),
    ]);

    return { total, new: newCustomers, frequent, vip };
  }
}

module.exports = { CustomersRepository };
