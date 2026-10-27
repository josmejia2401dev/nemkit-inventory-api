'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');
const { EMPLOYEE_PAYMENT_TYPES, EMPLOYEE_PAYMENT_METHODS } = require('./employee-payments.constants');

const EmployeePaymentSchema = applyPlatformSchema({
  // Cuenta de empresa propietaria del registro.
  userId: { type: Number, required: true, index: true },
  employeeId: { type: Number, required: true, min: 1, index: true },
  employeeSnapshot: {
    name: { type: String, required: true },
    documentType: { type: String, default: '' },
    documentNumber: { type: String, default: '' },
  },
  paymentDate: { type: Date, required: true, index: true },
  periodStart: { type: Date, default: null },
  periodEnd: { type: Date, default: null },
  type: { type: String, enum: EMPLOYEE_PAYMENT_TYPES, required: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: EMPLOYEE_PAYMENT_METHODS, default: 'other' },
  reference: { type: String, trim: true, default: '', maxlength: 120 },
  notes: { type: String, trim: true, default: '', maxlength: 1000 },
  recordedById: { type: Number, required: true, min: 1 },
  recordedBySnapshot: { name: { type: String, default: '' } },
});

EmployeePaymentSchema.index({ userId: 1, paymentDate: -1, _id: -1 });
EmployeePaymentSchema.index({ userId: 1, employeeId: 1, paymentDate: -1, _id: -1 });

module.exports = mongoose.model('inventory_employee_payments', EmployeePaymentSchema);
