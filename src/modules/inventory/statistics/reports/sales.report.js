'use strict';

const { RECORD_STATUS } = require('nemkit');
const { withTimeout } = require('../shared/db');
const { REPORT_TIMEZONE, grossProfitExpression } = require('../shared/aggregations');
const { DOCUMENT_STATUS, PAYMENT_STATUS } = require('../../inventory.constants');

/** Ventas cobradas agrupadas por día/semana/mes con utilidad bruta. */
function salesReport(models, userId, from, toExclusive, groupBy, employeeId = null) {
  const match = {
    userId,
    recordStatus: RECORD_STATUS.ACTIVE,
    status: { $ne: DOCUMENT_STATUS.VOID },
    paymentStatus: PAYMENT_STATUS.PAID,
    date: { $gte: from, $lt: toExclusive },
  };
  if (employeeId !== null) match.employeeId = employeeId;
  return withTimeout(models.Sale.aggregate([
    { $match: match },
    { $addFields: { unitsSold: { $sum: '$items.quantity' }, grossProfit: grossProfitExpression(), period: { $dateTrunc: { date: '$date', unit: groupBy, ...(groupBy === 'week' ? { startOfWeek: 'monday' } : {}), timezone: REPORT_TIMEZONE } } } },
    { $facet: {
      periods: [
        { $group: { _id: '$period', salesCount: { $sum: 1 }, unitsSold: { $sum: '$unitsSold' }, revenue: { $sum: '$total' }, grossProfit: { $sum: '$grossProfit' } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, periodStart: '$_id', salesCount: 1, unitsSold: 1, revenue: 1, grossProfit: 1 } },
      ],
      totals: [
        { $group: { _id: null, salesCount: { $sum: 1 }, unitsSold: { $sum: '$unitsSold' }, revenue: { $sum: '$total' }, grossProfit: { $sum: '$grossProfit' } } },
        { $project: { _id: 0 } },
      ],
    } },
  ]));
}

module.exports = { salesReport };
