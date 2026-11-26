'use strict';

const { RECORD_STATUS } = require('nemkit');
const { withTimeout } = require('../shared/db');
const {
  DOCUMENT_STATUS,
  PAYMENT_STATUS,
  LAYAWAY_STATUS,
} = require('../../inventory.constants');

/**
 * Flujo de caja del periodo: lo que entra por ventas cobradas y abonos de
 * Plan separe, y lo que sale por compras, pagos a empleados, retiros y
 * devoluciones de planes separe.
 *
 * Las ventas de un Plan separe se registran con `settledByLayaway = true` y se
 * excluyen de los ingresos porque el dinero ya entró por cada abono.
 */
function cashFlow(models, userId, from, toExclusive) {
  const {
    Sale,
    Purchase,
    EmployeePayment,
    CashWithdrawal,
    LayawayPayment,
    Layaway,
  } = models;
  const salesMatch = {
    userId,
    recordStatus: RECORD_STATUS.ACTIVE,
    status: { $ne: DOCUMENT_STATUS.VOID },
    paymentStatus: PAYMENT_STATUS.PAID,
    paidAt: { $gte: from, $lt: toExclusive },
    settledByLayaway: { $ne: true },
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
  const layawayPaymentsMatch = {
    userId,
    recordStatus: RECORD_STATUS.ACTIVE,
    date: { $gte: from, $lt: toExclusive },
  };
  const layawayRefundsMatch = {
    userId,
    recordStatus: RECORD_STATUS.ACTIVE,
    status: LAYAWAY_STATUS.CANCELLED,
    cancelledAt: { $gte: from, $lt: toExclusive },
    'cancellation.refundAmount': { $gt: 0 },
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
    withTimeout(LayawayPayment.aggregate([
      { $match: layawayPaymentsMatch },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $project: { _id: 0, count: 1, total: 1 } },
    ])),
    withTimeout(Layaway.aggregate([
      { $match: layawayRefundsMatch },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$cancellation.refundAmount' } } },
      { $project: { _id: 0, count: 1, total: 1 } },
    ])),
  ]);
}

module.exports = { cashFlow };
