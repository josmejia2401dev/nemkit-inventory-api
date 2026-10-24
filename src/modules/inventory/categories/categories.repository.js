'use strict';
const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Category = require('./categories.model');

class CategoriesRepository extends MongoRepository {
  constructor() {
    super(Category);
  }

  findNamesByIds(userId, categoryIds) {
    return this._applyTimeout(this.model.find({
      userId,
      _id: { $in: categoryIds },
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id name').lean());
  }
}

module.exports = { CategoriesRepository };
