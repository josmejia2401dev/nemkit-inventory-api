'use strict';

const { MongoRepository } = require('nemkit');
const LayawaySettings = require('./layaway-settings.model');

class LayawaySettingsRepository extends MongoRepository {
  constructor() {
    super(LayawaySettings);
  }

  async findByUser(userId) {
    const doc = await this.model.findOne({ userId }).lean();
    return this.normalizeOutput(doc);
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
