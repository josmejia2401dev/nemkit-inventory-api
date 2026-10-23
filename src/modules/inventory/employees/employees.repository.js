'use strict';

const { MongoRepository } = require('nemkit');
const Employee = require('./employees.model');

class EmployeesRepository extends MongoRepository {
  constructor() {
    super(Employee);
  }
}

module.exports = { EmployeesRepository };
