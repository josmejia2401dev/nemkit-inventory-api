'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');
const { CASH_WITHDRAWAL_REASONS, CASH_WITHDRAWAL_METHODS } = require('./cash-withdrawals.constants');

/**
 * Retiro de caja: dinero que sale del negocio sin ser venta, compra ni costo.
 * Vive en una colección aislada para que las métricas de ventas, utilidad y
 * fidelización no cambien por construcción.
 */
const CashWithdrawalSchema = applyPlatformSchema({
  // Cuenta de empresa propietaria del registro.
  userId: { type: Number, required: true, index: true },
  // Día calendario normalizado a 05:00Z (corte America/Bogota).
  date: { type: Date, required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  reason: { type: String, enum: CASH_WITHDRAWAL_REASONS, required: true },
  beneficiary: { type: String, trim: true, default: '', maxlength: 120 },
  method: { type: String, enum: CASH_WITHDRAWAL_METHODS, default: 'cash' },
  reference: { type: String, trim: true, default: '', maxlength: 120 },
  notes: { type: String, trim: true, default: '', maxlength: 1000 },
  recordedById: { type: Number, required: true, min: 1 },
  recordedBySnapshot: { name: { type: String, default: '' } },
});

CashWithdrawalSchema.index({ userId: 1, date: -1, _id: -1 });
CashWithdrawalSchema.index({ userId: 1, reason: 1, date: -1 });

module.exports = mongoose.model('inventory_cash_withdrawals', CashWithdrawalSchema);
