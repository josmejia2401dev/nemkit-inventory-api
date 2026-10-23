'use strict';

const { MongoRepository } = require('nemkit');
const Table = require('./tables.model');

class TablesRepository extends MongoRepository {
  constructor() {
    super(Table);
  }
}

module.exports = { TablesRepository };
