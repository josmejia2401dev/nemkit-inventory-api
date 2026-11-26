'use strict';

const { MongoRepository } = require('nemkit');
const LayawayAuthorization = require('./layaway-authorizations.model');

class LayawayAuthorizationsRepository extends MongoRepository {
  constructor() {
    super(LayawayAuthorization);
  }

  async createInSession(data, session) {
    const [authorization] = await this.model.create([data], { session });
    return authorization;
  }

  consume(tokenHash, userId, customerId, total, session = null) {
    return this.model.findOneAndUpdate(
      {
        tokenHash,
        userId,
        customerId,
        total: { $gte: total },
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt: new Date() } },
      { returnDocument: 'after', ...(session ? { session } : {}) },
    );
  }
}

module.exports = { LayawayAuthorizationsRepository };
