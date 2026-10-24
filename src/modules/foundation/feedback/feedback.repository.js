'use strict';

const { MongoRepository } = require('nemkit');
const Feedback = require('./feedback.model');

class FeedbackRepository extends MongoRepository {
  constructor() {
    super(Feedback);
  }
}

module.exports = { FeedbackRepository };
