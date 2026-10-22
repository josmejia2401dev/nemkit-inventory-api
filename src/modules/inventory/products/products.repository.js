'use strict';
const { MongoRepository } = require('nemkit');
const Product = require('./products.model');

class ProductsRepository extends MongoRepository {
  constructor() {
    super(Product);
  }
}

module.exports = { ProductsRepository };
