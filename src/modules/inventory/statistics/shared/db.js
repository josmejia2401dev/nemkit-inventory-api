'use strict';

const { applyMongoTimeout } = require('nemkit');

const QUERY_TIMEOUT_MS = 30000;

/** Envuelve una consulta de solo lectura con el timeout estándar del módulo. */
function withTimeout(operation) {
  return applyMongoTimeout(operation, QUERY_TIMEOUT_MS);
}

module.exports = { withTimeout };
