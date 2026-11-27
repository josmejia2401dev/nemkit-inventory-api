'use strict';

const { foundation } = require('./foundation');

module.exports = {
  foundation,
  usersService: foundation.services.users,
  employeesService: foundation.services.employees,
  limitsService: foundation.services.limits,
};
