'use strict';

const { RECORD_STATUS } = require('nemkit');
const { withTimeout } = require('../shared/db');
const { DOCUMENT_STATUS, PAYMENT_STATUS } = require('../../inventory.constants');

/**
 * Flujo de caja del periodo: lo que entra por ventas cobradas y lo que sale
 * por compras registradas, pagos a empleados y retiros de caja.
 * Las compras se asumen pagadas al contado (el modelo no tiene crédito).
 */
function cashFlow(models, userId, from, toExclusive) {
  const { Sale, Purchase, EmployeePayment, CashWithdrawal } = models;
  const salesMatch = {
    userId,
    recordStatus: RECORD_STATUS.ACTIVE,
    status: { $ne: DOCUMENT_STATUS.VOID },
    paymentStatus: PAYMENT_STATUS.PAID,
    paidAt: { $gte: from, $lt: toExclusive },
  };
  const purchasesMatch = {
    userId,
    recordStatus: RECORD_STATUS.ACTIVE,
    status: DOCUMENT_STATUS.COMPLETED,
    date: { $gte: from, $lt: toExclusive },
  };
  const paymentsMatch = {
    userId,
    recordStatus: RECORD_STATUS.ACTIVE,
    paymentDate: { $gte: from, $lt: toExclusive },
  };
  const withdrawalsMatch = {
    userId,
    recordStatus: RECORD_STATUS.ACTIVE,
    date: { $gte: from, $lt: toExclusive },
  };

  return Promise.all([
    withTimeout(Sale.aggregate([
      { $match: salesMatch },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' } } },
      { $project: { _id: 0, count: 1, total: 1 } },
    ])),
    withTimeout(Purchase.aggregate([
      { $match: purchasesMatch },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' } } },
      { $project: { _id: 0, count: 1, total: 1 } },
    ])),
    withTimeout(EmployeePayment.aggregate([
      { $match: paymentsMatch },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $project: { _id: 0, count: 1, total: 1 } },
    ])),
    withTimeout(CashWithdrawal.aggregate([
      { $match: withdrawalsMatch },
      { $facet: {
        totals: [
          { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
          { $project: { _id: 0, count: 1, total: 1 } },
        ],
        byReason: [
          { $group: { _id: '$reason', count: { $sum: 1 }, total: { $sum: '$amount' } } },
          { $sort: { total: -1 } },
          { $project: { _id: 0, reason: '$_id', count: 1, total: 1 } },
        ],
      } },
    ])),
  ]);
}

module.exports = { cashFlow };
