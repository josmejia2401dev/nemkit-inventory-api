'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Supplier = require('./suppliers.model');

class SuppliersRepository extends MongoRepository {
  constructor() {
    super(Supplier);
  }

  findActiveForDocument(supplierId, userId, session = null) {
    let query = this.model.findOne({
      _id: supplierId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });

    if (session) query = query.session(session);

    return query.lean();
  }
}

module.exports = { SuppliersRepository };
