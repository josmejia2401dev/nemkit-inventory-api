'use strict';

const { MongoRepository } = require('nemkit');
const Token = require('./tokens.model');

class TokensRepository extends MongoRepository {
  constructor() { super(Token); }

  async findValidById(id) {
    const doc = await this.model.findOne({ _id: id, expiresAt: { $gt: new Date() } });
    return this.normalizeOutput(doc);
  }

  async deleteById(id) {
    const result = await this.model.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  /** Extiende la vigencia de una sesión viva (refresh deslizante). */
  async extendById(id, expiresAt) {
    const doc = await this.model.findOneAndUpdate(
      { _id: id, expiresAt: { $gt: new Date() } },
      { $set: { expiresAt } },
      { new: true },
    );
    return this.normalizeOutput(doc);
  }

  async deleteByUserAndAudience(userId, audience) {
    const result = await this.model.deleteMany({ userId, audience });
    return result.deletedCount > 0;
  }

  async deleteAllByUser(userId, session = null) {
    const result = await this.model.deleteMany({ userId }, session ? { session } : {});
    return { deletedCount: result.deletedCount };
  }
}

module.exports = { TokensRepository };
