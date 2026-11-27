'use strict';

const { foundation: nemkitFoundation } = require('nemkit');

const { LIMIT_PERIOD } = nemkitFoundation.constants;

/** Catálogo de planes de Nemkit Inventory. */
const PLANS = Object.freeze({
  free: Object.freeze({
    code: 'free',
    name: 'Gratuito',
    price: 0,
    currency: 'COP',
    limits: Object.freeze({
      employees: Object.freeze({ max: 15, period: LIMIT_PERIOD.TOTAL }),
      products: Object.freeze({ max: 100, period: LIMIT_PERIOD.TOTAL }),
      contacts: Object.freeze({ max: 300, period: LIMIT_PERIOD.TOTAL }),
    }),
    caps: Object.freeze({}),
  }),
});

module.exports = { PLANS };
