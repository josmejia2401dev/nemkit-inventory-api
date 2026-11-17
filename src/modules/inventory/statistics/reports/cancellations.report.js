'use strict';

const { RECORD_STATUS } = require('nemkit');
const { withTimeout } = require('../shared/db');
const { DOCUMENT_STATUS } = require('../../inventory.constants');

/** Ventas anuladas del periodo con su actor, motivo y nota. */
function cancelledSales(models, userId, from, toExclusive, { page, limit }) {
  return withTimeout(models.Sale.aggregate([
    { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: DOCUMENT_STATUS.VOID, voidedAt: { $gte: from, $lt: toExclusive } } },
    { $facet: {
      cancellations: [
        { $sort: { voidedAt: -1, _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { _id: 1, date: '$voidedAt', saleDate: '$date', total: 1, customerSnapshot: 1, employeeSnapshot: 1, voidedBy: 1, voidedBySnapshot: 1, voidReason: 1, voidNote: 1 } },
      ],
      totals: [{ $group: { _id: null, cancellationCount: { $sum: 1 }, cancelledValue: { $sum: '$total' } } }, { $project: { _id: 0, cancellationCount: 1, cancelledValue: 1 } }],
      count: [{ $count: 'total' }],
    } },
  ]));
}

module.exports = { cancelledSales };
