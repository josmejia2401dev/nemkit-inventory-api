'use strict';

/** Aplica el timeout a consultas y agregaciones Mongoose. */
function applyMongoTimeout(operation, timeoutMs = 30000) {
  if (!timeoutMs || timeoutMs <= 0) return operation;

  if (typeof operation?.maxTimeMS === 'function') {
    return operation.maxTimeMS(timeoutMs);
  }

  if (typeof operation?.option === 'function') {
    return operation.option({ maxTimeMS: timeoutMs });
  }

  throw new TypeError('Mongo operation does not support maxTimeMS');
}

module.exports = { applyMongoTimeout };
