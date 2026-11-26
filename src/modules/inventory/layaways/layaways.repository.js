'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Layaway = require('./layaways.model');
const { LAYAWAY_STATUS } = require('../inventory.constants');

class LayawaysRepository extends MongoRepository {
  constructor() {
    super(Layaway);
  }

  async createInSession(data, session) {
    const [document] = await this.model.create([data], { session });
    return document;
  }

  findOwnedInSession(id, userId, session) {
    return this.model.findOne({
      _id: id,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).session(session).lean();
  }

  updateOwnedInSession(id, userId, update, session = null) {
    return this.model.updateOne(
      { _id: id, userId, recordStatus: RECORD_STATUS.ACTIVE },
      update,
      session ? { session } : {},
    );
  }

  applyPaymentInSession(id, userId, amount, setFields, session) {
    return this.model.findOneAndUpdate(
      {
        _id: id,
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
        status: LAYAWAY_STATUS.ACTIVE,
        balance: { $gte: amount },
      },
      {
        $inc: { paidAmount: amount, balance: -amount },
        $set: setFields,
      },
      { session, returnDocument: 'after' },
    );
  }

  async summary(userId) {
    const now = new Date();
    const [row] = await this.model.aggregate([
      {
        $match: {
          userId,
          recordStatus: RECORD_STATUS.ACTIVE,
          status: { $in: [LAYAWAY_STATUS.ACTIVE, LAYAWAY_STATUS.READY] },
        },
      },
      {
        $group: {
          _id: null,
          activeCount: { $sum: { $cond: [{ $eq: ['$status', LAYAWAY_STATUS.ACTIVE] }, 1, 0] } },
          activeBalance: { $sum: { $cond: [{ $eq: ['$status', LAYAWAY_STATUS.ACTIVE] }, '$balance', 0] } },
          overdueCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', LAYAWAY_STATUS.ACTIVE] },
                    { $gt: ['$balance', 0] },
                    { $lt: ['$dueDate', now] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          overdueBalance: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', LAYAWAY_STATUS.ACTIVE] },
                    { $gt: ['$balance', 0] },
                    { $lt: ['$dueDate', now] },
                  ],
                },
                '$balance',
                0,
              ],
            },
          },
          readyCount: { $sum: { $cond: [{ $eq: ['$status', LAYAWAY_STATUS.READY] }, 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return row ?? {
      activeCount: 0,
      activeBalance: 0,
      overdueCount: 0,
      overdueBalance: 0,
      readyCount: 0,
    };
  }
}

module.exports = { LayawaysRepository };
