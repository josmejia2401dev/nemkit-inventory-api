'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Delivery = require('./deliveries.model');
const { DELIVERY_STATUS, KITCHEN_TO_DELIVERY_STATUS } = require('../inventory.constants');
const { applyMongoTimeout } = require('../../../config/mongo-query');

class DeliveriesRepository extends MongoRepository {
  constructor() {
    super(Delivery);
  }

  async createFromSale(data, session) {
    const [delivery] = await this.model.create([data], { session });
    return this.normalizeOutput(delivery);
  }

  async dashboardMetrics(userId) {
    const baseFilter = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    const [byStatus, average] = await Promise.all([
      applyMongoTimeout(this.model.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]), this.queryTimeoutMs),
      applyMongoTimeout(this.model.aggregate([
        {
          $match: {
            ...baseFilter,
            status: DELIVERY_STATUS.DELIVERED,
            'timeline.deliveredAt': { $ne: null },
          },
        },
        {
          $project: {
            minutes: { $divide: [{ $subtract: ['$timeline.deliveredAt', '$createdAt'] }, 60000] },
          },
        },
        { $group: { _id: null, avgMinutes: { $avg: '$minutes' } } },
      ]), this.queryTimeoutMs),
    ]);

    return { byStatus, averageMinutes: average[0]?.avgMinutes ?? null };
  }

  async syncFromKitchen(saleId, userId, kitchenStatus, session) {
    const target = KITCHEN_TO_DELIVERY_STATUS[kitchenStatus];
    if (!target) return;

    const delivery = await this._applyTimeout(this.model.findOne({
      saleId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id status').session(session).lean());
    if (!delivery) return;

    const kitchenPhase = [DELIVERY_STATUS.PENDING, DELIVERY_STATUS.PREPARING, DELIVERY_STATUS.READY];
    if (!kitchenPhase.includes(delivery.status) || delivery.status === target) return;

    await this._applyTimeout(this.model.updateOne(
      { _id: delivery._id, userId, recordStatus: RECORD_STATUS.ACTIVE },
      { $set: { status: target, updatedBy: userId } },
      { session },
    ));
  }

  async changeStatusInSession(id, userId, currentStatus, update, session) {
    const result = await this._applyTimeout(this.model.updateOne(
      { _id: id, userId, recordStatus: RECORD_STATUS.ACTIVE, status: currentStatus },
      { $set: { ...update, updatedBy: userId } },
      { session },
    ));
    if (result.matchedCount !== 1) return null;
    const delivery = await this._applyTimeout(this.model.findOne({
      _id: id,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).session(session).lean());
    return delivery ? this.normalizeOutput(delivery) : null;
  }

  async cancelBySale(saleId, userId, session) {
    return this._applyTimeout(this.model.updateOne(
      {
        saleId,
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
        status: { $ne: DELIVERY_STATUS.CANCELLED },
      },
      {
        $set: {
          status: DELIVERY_STATUS.CANCELLED,
          'timeline.cancelledAt': new Date(),
          updatedBy: userId,
        },
      },
      { session },
    ));
  }

  existsForSale(saleId, userId) {
    return this._applyTimeout(this.model.exists({
      saleId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }));
  }
}

module.exports = { DeliveriesRepository };
