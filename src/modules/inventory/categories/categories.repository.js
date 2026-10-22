'use strict';
const { MongoRepository } = require('nemkit');
const Category = require('./categories.model');

class CategoriesRepository extends MongoRepository {
  constructor() {
    super(Category);
  }
}

module.exports = { CategoriesRepository };
