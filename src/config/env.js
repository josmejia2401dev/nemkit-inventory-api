'use strict';

const { loadEnv } = require('nemkit');
const path = require('path');

const env = loadEnv({
  NODE_ENV:       { default: 'development' },
  HOST:           { default: () => process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost' },
  PORT:           { type: 'number', default: () => process.env.PORT || 4000 },
  API_PREFIX:     { default: '/api/v1' },

  MONGODB_URI:                { required: true },
  MONGODB_TLS:                { type: 'boolean', default: false },
  MONGODB_TLS_ALLOW_INVALID:  { type: 'boolean', default: false },
  MONGODB_USE_SERVER_API:     { type: 'boolean', default: false },

  JWT_SECRET:             { required: true },
  JWT_EXPIRES_IN:         { default: '30m' },
  JWT_REFRESH_SECRET:     { required: true },
  JWT_REFRESH_EXPIRES_IN: { default: '7d' },

  CORS_ORIGINS:          { type: 'array', default: ['http://localhost:4200'] },
  RATE_LIMIT_WINDOW_MS:  { type: 'number', default: 900000 },
  RATE_LIMIT_MAX:        { type: 'number', default: 1000 },

  LOG_LEVEL:            { default: 'info' },
  LOGS_LOCAL_PATH:      { default: './logs' },
  REQUEST_LOG_ENABLED:  { type: 'boolean', default: true },

  STORAGE_TMP_PATH:        { default: './tmp/storage' },
  STORAGE_MEMORY_LIMIT_MB: { type: 'number', default: 5 },   // < 5MB → staging en RAM
  STORAGE_MAX_FILE_MB:     { type: 'number', default: 15 },  // límite hard (BSON < 16MB)
  STORAGE_STAGING_TTL_MS:  { type: 'number', default: 1800000 },

  // Seed del admin (primer arranque, si no hay usuarios).
  // Los tres son REQUERIDOS y sin default: nada de credenciales del admin
  // queda hardcodeado en el código. Deben venir del entorno (.env / Render).
  ADMIN_EMAIL:    { required: true },
  ADMIN_PASSWORD: { required: true },
  ADMIN_FULLNAME: { required: true },
}, {
  path: path.resolve(__dirname, '../..'),
  environment: process.env.NODE_ENV ?? 'production',
  requireFile: false
});

module.exports = { env };
