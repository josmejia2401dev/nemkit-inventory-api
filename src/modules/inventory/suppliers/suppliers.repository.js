'use strict';

const { MongoRepository } = require('nemkit');
const Supplier = require('./suppliers.model');

class SuppliersRepository extends MongoRepository {
  constructor() {
    super(Supplier);
  }
}

module.exports = { SuppliersRepository };
