'use strict';

const { MongoRepository } = require('nemkit');
const User = require('./users.model');

class UsersRepository extends MongoRepository {
  constructor() { super(User); }

  async findByEmail(email) {
    const doc = await this.model.findOne({ email, ...this._baseFilter() }).select('+passwordHash');
    return this.normalizeOutput(doc);
  }

  async findByIdWithPassword(id) {
    const doc = await this.model.findOne({ _id: id, ...this._baseFilter() }).select('+passwordHash');
    return this.normalizeOutput(doc);
  }

  async findByResetToken(token) {
    const doc = await this.model
      .findOne({ 'security.passwordResetToken': token, ...this._baseFilter() })
      .select('+security.passwordResetToken +security.passwordResetExpires');
    return this.normalizeOutput(doc);
  }

  async updateLoginSecurity(id, data) {
    const doc = await this.model.findOneAndUpdate({ _id: id }, data, { returnDocument: 'after' });
    return this.normalizeOutput(doc);
  }
}

module.exports = { UsersRepository };
