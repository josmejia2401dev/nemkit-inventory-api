'use strict';

const { MongoRepository } = require('nemkit');
const Customer = require('./customers.model');

class CustomersRepository extends MongoRepository {
  constructor() {
    super(Customer);
  }
}

module.exports = { CustomersRepository };
