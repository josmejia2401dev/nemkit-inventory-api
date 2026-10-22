'use strict';

const path = require('path');
const { createStorageHandler } = require('nemkit');
const { env } = require('./env');

const MB = 1024 * 1024;

const storageHandler = createStorageHandler({
  tmpDir: path.resolve(env.STORAGE_TMP_PATH),
  memoryLimit: env.STORAGE_MEMORY_LIMIT_MB * MB,
  maxFileSize: env.STORAGE_MAX_FILE_MB * MB,
  ttlMs: env.STORAGE_STAGING_TTL_MS,
});

module.exports = { storageHandler };
