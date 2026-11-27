'use strict';

const { MongoRepository } = require('nemkit');
const LayawaySettings = require('./layaway-settings.model');

class LayawaySettingsRepository extends MongoRepository {
  constructor() {
    super(LayawaySettings);
  }

  findByUser(userId) {
    return this.normalizeOutput(this.model.findOne({ userId }).lean());
  }

  async save(userId, data, actorId) {
    const doc = await this.model.findOneAndUpdate(
      { userId },
      {
        $set: { ...data, updatedBy: actorId },
        $setOnInsert: { _id: userId, userId, createdBy: actorId },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    return this.normalizeOutput(doc);
  }
}

module.exports = { LayawaySettingsRepository };
