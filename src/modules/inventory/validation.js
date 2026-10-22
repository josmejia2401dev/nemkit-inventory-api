'use strict';

const { HttpError } = require('nemkit');

function positiveInteger(value, field, { optional = false, fallback } = {}) {
  if ((value === undefined || value === null || value === '') && optional) {
    return fallback;
  }

  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw HttpError.badRequest(`${field} must be a positive integer`);
  }

  return number;
}

function pagination(query = {}) {
  const page = query.page === undefined ? 1 : positiveInteger(query.page, 'page');
  const limit = query.limit === undefined ? 20 : positiveInteger(query.limit, 'limit');
  return {
    page,
    limit: Math.min(limit, 100),
  };
}

function parseDate(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw HttpError.badRequest(`${field} must be a valid date`);
  }

  return date;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertNoEmptyUpdate(value, fields) {
  if (!fields.some((field) => value[field] !== undefined)) {
    throw HttpError.badRequest('At least one updatable field is required');
  }
}

function validateProductFields(data) {
  for (const field of ['purchasePrice', 'salePrice', 'minimumStock']) {
    const isInvalid = data[field] !== undefined
      && (typeof data[field] !== 'number' || !Number.isFinite(data[field]) || data[field] < 0);

    if (isInvalid) {
      throw HttpError.badRequest(`${field} must be a finite non-negative number`);
    }
  }

  if (data.image !== undefined) {
    const image = data.image;
    if (!image || typeof image !== 'object' || Array.isArray(image)) {
      throw HttpError.badRequest('image must be an object');
    }

    const allowed = new Set(['url', 'storageKey']);
    if (Object.keys(image).some((key) => !allowed.has(key))) {
      throw HttpError.badRequest('image contains unsupported fields');
    }

    for (const field of allowed) {
      const maxLength = field === 'url' ? 2048 : 512;
      const isInvalid = image[field] !== undefined
        && (typeof image[field] !== 'string' || image[field].length > maxLength);

      if (isInvalid) {
        throw HttpError.badRequest(`image.${field} must be a string within the allowed length`);
      }
    }

    if (image.url) {
      let parsedUrl;
      try {
        parsedUrl = new URL(image.url);
      } catch {
        throw HttpError.badRequest('image.url must be a valid HTTP(S) URL');
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw HttpError.badRequest('image.url must use HTTP or HTTPS');
      }
    }
  }
}

function translateDuplicateKey(error) {
  if (error?.code === 11000) {
    throw HttpError.conflict('A product or category with the same unique code or name already exists');
  }

  throw error;
}

module.exports = {
  positiveInteger,
  pagination,
  parseDate,
  escapeRegex,
  assertNoEmptyUpdate,
  validateProductFields,
  translateDuplicateKey,
};
