'use strict';

const { MongoRepository } = require('nemkit');
const Delivery = require('./deliveries.model');

class DeliveriesRepository extends MongoRepository {
  constructor() {
    super(Delivery);
  }
}

module.exports = { DeliveriesRepository };
