'use strict';

const { HttpError } = require('nemkit');
const { positiveInteger } = require('../../validation');

const REPORT_TIMEZONE = 'America/Bogota';
const MAX_RANGE_DAYS = 366;

/** Redondeo monetario a dos decimales, estable ante errores de coma flotante. */
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Suma un campo monetario de una lista de filas y redondea el total. */
function sum(rows, field) {
  return roundMoney(rows.reduce((total, row) => total + row[field], 0));
}

/** Utilidad bruta de una venta: (precio - costo) × cantidad por ítem. */
function grossProfitExpression() {
  return {
    $reduce: {
      input: '$items',
      initialValue: 0,
      in: { $add: ['$$value', { $multiply: [{ $subtract: ['$$this.unitPrice', '$$this.unitCost'] }, '$$this.quantity'] }] },
    },
  };
}

/** Rango [from, toExclusive) en UTC de Bogotá a partir de `YYYY-MM-DD`. */
function dateRange(query, { enforceMax = true } = {}) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const { from, to } = query;
  if (typeof from !== 'string' || !datePattern.test(from) || typeof to !== 'string' || !datePattern.test(to)) {
    throw HttpError.badRequest('from and to must use YYYY-MM-DD format');
  }
  const fromDate = new Date(`${from}T05:00:00.000Z`);
  const toDate = new Date(`${to}T05:00:00.000Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())
    || fromDate.toISOString().slice(0, 10) !== from || toDate.toISOString().slice(0, 10) !== to) {
    throw HttpError.badRequest('from and to must be valid calendar dates');
  }
  if (fromDate > toDate) throw HttpError.badRequest('from must be before or equal to to');
  const toExclusive = new Date(toDate.getTime() + 86400000);
  if (enforceMax && (toExclusive - fromDate) / 86400000 > MAX_RANGE_DAYS) {
    throw HttpError.badRequest(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }
  return { from: fromDate, toExclusive };
}

/** Paginación de reportes: 1..N y tope de 500 filas por página. */
function pageOptions(query) {
  const page = query.page === undefined ? 1 : positiveInteger(query.page, 'page');
  const requestedLimit = query.limit === undefined ? 100 : positiveInteger(query.limit, 'limit');
  return { page, limit: Math.min(requestedLimit, 500) };
}

module.exports = {
  REPORT_TIMEZONE,
  MAX_RANGE_DAYS,
  roundMoney,
  sum,
  grossProfitExpression,
  dateRange,
  pageOptions,
};
