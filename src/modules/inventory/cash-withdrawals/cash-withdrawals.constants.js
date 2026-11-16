'use strict';

/**
 * Motivos de retiro de caja. No son estados contables: describen para qué sale
 * el dinero y solo alimentan el desglose del flujo de caja.
 */
const CASH_WITHDRAWAL_REASONS = Object.freeze([
  'owner_withdrawal', // retiro del dueño/jefe
  'petty_cash', // caja menor
  'operating_expense', // gasto operativo pagado en efectivo
  'other',
]);

const CASH_WITHDRAWAL_METHODS = Object.freeze([
  'cash',
  'transfer',
  'other',
]);

const CASH_WITHDRAWAL_REASON_LABELS = Object.freeze({
  owner_withdrawal: 'Retiro del dueño',
  petty_cash: 'Caja menor',
  operating_expense: 'Gasto operativo',
  other: 'Otro',
});

module.exports = {
  CASH_WITHDRAWAL_REASONS,
  CASH_WITHDRAWAL_METHODS,
  CASH_WITHDRAWAL_REASON_LABELS,
};
