'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');
const {
  LAYAWAY_STATUS,
  LAYAWAY_STATUSES,
  LAYAWAY_FREQUENCIES,
  LAYAWAY_HANDOVER_MODES,
  LAYAWAY_HANDOVER_STATUS,
  LAYAWAY_HANDOVER_STATUSES,
  LAYAWAY_ZERO_DOWN_POLICIES,
  LAYAWAY_CANCELLATION_POLICIES,
  LAYAWAY_RETURN_CONDITIONS,
  LAYAWAY_PAYMENT_METHODS,
} = require('../inventory.constants');

const LayawayItemSchema = new mongoose.Schema({
  productId: { type: Number, required: true, min: 1 },
  sku: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  unitPrice: { type: Number, required: true, min: 0 },
  unitCost: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const LayawaySchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  customerId: { type: Number, required: true, index: true },
  customerSnapshot: {
    name: { type: String, required: true, trim: true },
    document: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  items: {
    type: [LayawayItemSchema],
    required: true,
    validate: { validator: (value) => Array.isArray(value) && value.length > 0, message: 'At least one item is required' },
  },
  total: { type: Number, required: true, min: 0 },
  initialPayment: { type: Number, default: 0, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  balance: { type: Number, default: 0, min: 0 },
  installmentAmount: { type: Number, default: 0, min: 0 },
  frequency: { type: String, enum: LAYAWAY_FREQUENCIES, default: 'monthly' },
  startDate: { type: Date, required: true, index: true },
  dueDate: { type: Date, required: true, index: true },
  nextDueDate: { type: Date, default: null },

  status: { type: String, enum: LAYAWAY_STATUSES, default: LAYAWAY_STATUS.ACTIVE, index: true },
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending', index: true },
  handoverMode: { type: String, enum: LAYAWAY_HANDOVER_MODES, required: true },
  handoverStatus: { type: String, enum: LAYAWAY_HANDOVER_STATUSES, default: LAYAWAY_HANDOVER_STATUS.PENDING, index: true },
  deliveredAt: { type: Date, default: null },

  delivery: {
    type: {
      address: { type: String, default: '', trim: true },
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
      courierId: { type: Number, default: null },
      courierSnapshot: { name: { type: String, default: '' } },
    },
    default: null,
  },

  authorization: {
    type: {
      required: { type: Boolean, default: false },
      authorizedBy: { type: Number, default: null },
      authorizedByName: { type: String, default: '' },
      authorizedAt: { type: Date, default: null },
      method: { type: String, enum: ['password', 'pin', 'remote'], default: 'password' },
      note: { type: String, default: '', maxlength: 300 },
      requestId: { type: Number, default: null },
    },
    default: null,
  },

  settingsSnapshot: {
    type: {
      minInitialPercent: { type: Number, default: 0 },
      maxTermMonths: { type: Number, default: 60 },
      cancellationPolicy: { type: String, enum: LAYAWAY_CANCELLATION_POLICIES, default: 'manual' },
      retentionPercent: { type: Number, default: 0 },
      allowImmediateHandover: { type: Boolean, default: true },
      zeroDownImmediatePolicy: { type: String, enum: LAYAWAY_ZERO_DOWN_POLICIES, default: 'admin_authorization' },
    },
    default: null,
  },

  reservationMovementId: { type: Number, default: null },
  releaseMovementId: { type: Number, default: null },
  saleId: { type: Number, default: null, index: true },
  saleCreatedAt: { type: Date, default: null },

  cancelledAt: { type: Date, default: null },
  cancellation: {
    type: {
      reason: { type: String, default: '' },
      note: { type: String, default: '', maxlength: 300 },
      productReturned: { type: Boolean, default: false },
      returnCondition: { type: String, enum: LAYAWAY_RETURN_CONDITIONS, default: 'not_returned' },
      restock: { type: Boolean, default: false },
      refundAmount: { type: Number, default: 0, min: 0 },
      refundMethod: { type: String, enum: LAYAWAY_PAYMENT_METHODS, default: 'cash' },
      retainedAmount: { type: Number, default: 0, min: 0 },
      writeOffAmount: { type: Number, default: 0, min: 0 },
    },
    default: null,
  },

  notes: { type: String, trim: true, default: '', maxlength: 1000 },
});

LayawaySchema.index({ userId: 1, status: 1, dueDate: 1 });
LayawaySchema.index({ userId: 1, customerId: 1, status: 1 });
LayawaySchema.index({ userId: 1, createdAt: -1 });
LayawaySchema.index({ userId: 1, paymentStatus: 1, dueDate: 1 });
LayawaySchema.index({ userId: 1, saleId: 1 }, { partialFilterExpression: { saleId: { $type: 'number' } } });

module.exports = mongoose.model('inventory_layaways', LayawaySchema);
