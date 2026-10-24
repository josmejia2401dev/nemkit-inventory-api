'use strict';

const { HttpError } = require('nemkit');

function paginationOptions(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 100)) {
    throw HttpError.badRequest('search must be a string of at most 100 characters');
  }
  const search = query.search?.trim() ? escapeRegex(query.search.trim()) : null;
  return { page, limit, search };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { paginationOptions, escapeRegex };
