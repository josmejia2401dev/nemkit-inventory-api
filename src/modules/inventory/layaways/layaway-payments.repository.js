'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const LayawayPayment = require('./layaway-payments.model');

class LayawayPaymentsRepository extends MongoRepository {
  constructor() {
    super(LayawayPayment);
  }

  listByLayaway(userId, layawayId) {
    return this.model.find({
      userId,
      layawayId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).sort({ date: -1, _id: -1 }).limit(200).lean();
  }

  async createInSession(data, session) {
    const [payment] = await this.model.create([data], { session });
    return payment;
  }
}

module.exports = { LayawayPaymentsRepository };
