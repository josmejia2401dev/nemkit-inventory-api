'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');

class InventoryDocumentRepository extends MongoRepository {
  async createInSession(data, session) {
    const [document] = await this.model.create([data], { session });
    return document;
  }

  findOwnedInSession(id, userId, session) {
    return this._applyTimeout(this.model.findOne({
      _id: id,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).session(session).lean());
  }

  updateOwnedInSession(id, userId, update, session) {
    return this._applyTimeout(this.model.updateOne(
      { _id: id, userId },
      update,
      { session },
    ));
  }
}

module.exports = { InventoryDocumentRepository };
