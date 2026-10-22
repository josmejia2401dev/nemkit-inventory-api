'use strict';
const { MongoRepository } = require('nemkit');
const Movement = require('./movements.model');

class MovementsRepository extends MongoRepository {
  constructor() {
    super(Movement);
  }
}

module.exports = { MovementsRepository };
