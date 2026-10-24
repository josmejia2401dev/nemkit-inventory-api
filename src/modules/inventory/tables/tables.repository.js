'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Table = require('./tables.model');

class TablesRepository extends MongoRepository {
  constructor() {
    super(Table);
  }

  listForOccupancy(userId) {
    return this._applyTimeout(this.model.find({
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id name description').sort({ name: 1 }).lean());
  }
}

module.exports = { TablesRepository };
