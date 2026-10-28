'use strict';
const { MongoRepository } = require('nemkit');
const Movement = require('./movements.model');

class MovementsRepository extends MongoRepository {
  constructor() {
    super(Movement);
  }

  async createInSession(data, session) {
    const [movement] = await this.model.create([data], { session });
    return movement;
  }


}

module.exports = { MovementsRepository };
