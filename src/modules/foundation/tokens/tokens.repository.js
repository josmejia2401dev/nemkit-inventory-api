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

  async deleteByUserAndAudience(userId, audience) {
    const result = await this.model.deleteMany({ userId, audience });
    return result.deletedCount > 0;
  }

  async deleteAllByUser(userId) {
    const result = await this.model.deleteMany({ userId });
    return { deletedCount: result.deletedCount };
  }
}

module.exports = { TokensRepository };
