'use strict';

const { MongoClient } = require('nemkit');
const { env } = require('./env');
const logger = require('./logger');

const mongoClient = new MongoClient({
  uri: env.MONGODB_URI,
  logger,
  tls: env.MONGODB_TLS,
  tlsAllowInvalidCertificates: env.MONGODB_TLS_ALLOW_INVALID,
  useServerApi: env.MONGODB_USE_SERVER_API,
});

module.exports = { mongoClient };
