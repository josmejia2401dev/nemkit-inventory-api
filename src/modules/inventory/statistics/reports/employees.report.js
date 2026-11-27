'use strict';

const { RECORD_STATUS } = require('nemkit');
const { withTimeout } = require('../shared/db');
const { grossProfitExpression } = require('../shared/aggregations');
const { DOCUMENT_STATUS, PAYMENT_STATUS } = require('../../inventory.constants');

/** Ventas, cobros y anulaciones agrupadas por empleado. */
function salesByEmployee(models, userId, from, toExclusive) {
  const { Sale } = models;
  return Promise.all([
    withTimeout(Sale.aggregate([
      { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: { $ne: DOCUMENT_STATUS.VOID }, date: { $gte: from, $lt: toExclusive } } },
      { $addFields: { unitsSold: { $sum: '$items.quantity' }, grossProfit: grossProfitExpression() } },
      { $group: {
        _id: '$employeeId',
        employeeName: { $last: '$employeeSnapshot.name' },
        salesCount: { $sum: 1 },
        unitsSold: { $sum: '$unitsSold' },
        revenue: { $sum: '$total' },
        collectedValue: { $sum: { $cond: [{ $eq: ['$paymentStatus', PAYMENT_STATUS.PAID] }, '$total', 0] } },
        pendingValue: { $sum: { $cond: [{ $eq: ['$paymentStatus', PAYMENT_STATUS.PENDING] }, '$total', 0] } },
        grossProfit: { $sum: '$grossProfit' },
      } },
      { $sort: { revenue: -1 } },
      { $project: { _id: 0, employeeId: '$_id', employeeName: 1, salesCount: 1, unitsSold: 1, revenue: 1, collectedValue: 1, pendingValue: 1, grossProfit: 1 } },
    ])),
    withTimeout(Sale.aggregate([
      { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: { $ne: DOCUMENT_STATUS.VOID }, paymentStatus: PAYMENT_STATUS.PAID, paidAt: { $gte: from, $lt: toExclusive } } },
      { $group: { _id: '$employeeId', employeeName: { $last: '$employeeSnapshot.name' }, collectionsCount: { $sum: 1 }, collectedInPeriod: { $sum: '$total' } } },
      { $project: { _id: 0, employeeId: '$_id', employeeName: 1, collectionsCount: 1, collectedInPeriod: 1 } },
    ])),
    withTimeout(Sale.aggregate([
      { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: DOCUMENT_STATUS.VOID, voidedAt: { $gte: from, $lt: toExclusive } } },
      { $addFields: {
        cancellationActorId: { $ifNull: ['$voidedBy', '$employeeId'] },
        cancellationActorName: { $cond: [{ $ne: ['$voidedBy', null] }, '$voidedBySnapshot.name', '$employeeSnapshot.name'] },
      } },
      { $group: { _id: '$cancellationActorId', employeeName: { $last: '$cancellationActorName' }, cancellationCount: { $sum: 1 }, cancelledValue: { $sum: '$total' } } },
      { $project: { _id: 0, employeeId: '$_id', employeeName: 1, cancellationCount: 1, cancelledValue: 1 } },
    ])),
  ]);
}

module.exports = { salesByEmployee };
