'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Customer = require('./customers.model');

class CustomersRepository extends MongoRepository {
  constructor() {
    super(Customer);
  }

  findActiveForDocument(customerId, userId, session = null) {
    let query = this.model.findOne({
      _id: customerId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });

    if (session) query = query.session(session);

    return this._applyTimeout(query.lean());
  }

}

module.exports = { CustomersRepository };
