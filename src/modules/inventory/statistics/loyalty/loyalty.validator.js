'use strict';

const { createValidator } = require('nemkit');

const integer = (value, field) => (Number.isSafeInteger(value) ? null : `${field} must be an integer`);

module.exports = {
  customerProfileQuerySchema: createValidator({
    page: { type: 'number', toNumber: true, min: 1, max: 100000, custom: integer },
    limit: { type: 'number', toNumber: true, min: 1, max: 100, custom: integer },
  }),
};
