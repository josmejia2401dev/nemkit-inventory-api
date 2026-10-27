'use strict';

const { createValidator, HttpError } = require('nemkit');
const { DELIVERY_STATUSES } = require('../inventory.constants');

const isInteger = (value, field) => (Number.isSafeInteger(value) ? null : `${field} must be an integer`);

const statusSchema = createValidator({
  status: { type: 'string', required: true, enum: DELIVERY_STATUSES },
});

const courierSchema = createValidator({
  courierId: { type: 'number', required: true, min: 1 },
});

const listQuerySchema = createValidator({
  page: { type: 'number', toNumber: true, min: 1, max: 100000, custom: isInteger },
  limit: { type: 'number', toNumber: true, min: 1, max: 100, custom: isInteger },
  status: { type: 'string', enum: DELIVERY_STATUSES },
  courierId: { type: 'number', toNumber: true, min: 1, custom: isInteger },
  customerId: { type: 'number', toNumber: true, min: 1, custom: isInteger },
});

const proofSchema = createValidator({ proof: { type: 'object', required: true } });
const voidSchema = createValidator({ reason: { type: 'string', trim: true, maxLength: 1000 } });

function validateProof(proof) {
  const allowed = new Set(['photo', 'signature', 'observation']);
  if (Object.keys(proof).some((key) => !allowed.has(key))) {
    throw HttpError.badRequest('proof contains unsupported fields');
  }
  const result = {};
  for (const field of ['photo', 'signature']) {
    if (proof[field] !== undefined) result[field] = validateMedia(proof[field], field);
  }
  if (proof.observation !== undefined) {
    if (typeof proof.observation !== 'string' || proof.observation.length > 1000) {
      throw HttpError.badRequest('proof.observation must be a string of at most 1000 characters');
    }
    result.observation = proof.observation.trim();
  }
  return result;
}

function validateMedia(media, field) {
  if (!media || typeof media !== 'object' || Array.isArray(media)) {
    throw HttpError.badRequest(`proof.${field} must be an object`);
  }
  const allowed = new Set(['url', 'storageKey']);
  if (Object.keys(media).some((key) => !allowed.has(key))) {
    throw HttpError.badRequest(`proof.${field} contains unsupported fields`);
  }
  for (const key of allowed) {
    const maxLength = key === 'url' ? 2048 : 512;
    if (media[key] !== undefined && (typeof media[key] !== 'string' || media[key].length > maxLength)) {
      throw HttpError.badRequest(`proof.${field}.${key} must be a string within the allowed length`);
    }
  }
  if (media.url) {
    let parsed;
    try { parsed = new URL(media.url); } catch { throw HttpError.badRequest(`proof.${field}.url must be a valid HTTP(S) URL`); }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw HttpError.badRequest(`proof.${field}.url must use HTTP or HTTPS`);
    }
  }
  return media;
}

module.exports = { statusSchema, courierSchema, listQuerySchema, proofSchema, voidSchema, validateProof };
