'use strict';

const { createValidator } = require('nemkit');
const {
  LAYAWAY_FREQUENCIES,
  LAYAWAY_PAYMENT_METHODS,
  LAYAWAY_HANDOVER_MODES,
  LAYAWAY_RETURN_CONDITIONS,
  LAYAWAY_CANCEL_REASONS,
  LAYAWAY_CANCELLATION_POLICIES,
} = require('../inventory.constants');

const createLayawaySchema = createValidator({
  customerId: { type: 'number', required: true, min: 1 },
  items: { type: 'array', required: true, minLength: 1 },
  initialPayment: { type: 'number', min: 0 },
  initialPaymentMethod: { type: 'string', enum: LAYAWAY_PAYMENT_METHODS },
  initialPaymentReference: { type: 'string', trim: true, maxLength: 100 },
  installmentAmount: { type: 'number', min: 0 },
  frequency: { type: 'string', enum: LAYAWAY_FREQUENCIES },
  dueDate: { type: 'date', required: true },
  startDate: { type: 'date' },
  handoverMode: { type: 'string', enum: LAYAWAY_HANDOVER_MODES },
  delivery: { type: 'object' },
  notes: { type: 'string', trim: true, maxLength: 1000 },
  employeeId: { type: 'number', min: 1 },
});

const updateLayawaySchema = createValidator({
  dueDate: { type: 'date' },
  frequency: { type: 'string', enum: LAYAWAY_FREQUENCIES },
  installmentAmount: { type: 'number', min: 0 },
  notes: { type: 'string', trim: true, maxLength: 1000 },
});

const paymentSchema = createValidator({
  amount: { type: 'number', required: true, min: 0.01 },
  method: { type: 'string', enum: LAYAWAY_PAYMENT_METHODS },
  date: { type: 'date' },
  reference: { type: 'string', trim: true, maxLength: 100 },
  notes: { type: 'string', trim: true, maxLength: 300 },
  employeeId: { type: 'number', min: 1 },
});

const deliverSchema = createValidator({
  date: { type: 'date' },
  notes: { type: 'string', trim: true, maxLength: 1000 },
});

const cancelSchema = createValidator({
  reason: { type: 'string', required: true, enum: LAYAWAY_CANCEL_REASONS },
  note: { type: 'string', trim: true, maxLength: 300 },
  productReturned: { type: 'boolean' },
  returnCondition: { type: 'string', enum: LAYAWAY_RETURN_CONDITIONS },
  refundAmount: { type: 'number', min: 0 },
  refundMethod: { type: 'string', enum: LAYAWAY_PAYMENT_METHODS },
});

const settingsSchema = createValidator({
  minInitialPercent: { type: 'number', min: 0, max: 100 },
  maxTermMonths: { type: 'number', min: 1, max: 60 },
  defaultFrequency: { type: 'string', enum: LAYAWAY_FREQUENCIES },
  cancellationPolicy: { type: 'string', enum: LAYAWAY_CANCELLATION_POLICIES },
  retentionPercent: { type: 'number', min: 0, max: 100 },
  allowImmediateHandover: { type: 'boolean' },
});

module.exports = {
  createLayawaySchema,
  updateLayawaySchema,
  paymentSchema,
  deliverSchema,
  cancelSchema,
  settingsSchema,
};
