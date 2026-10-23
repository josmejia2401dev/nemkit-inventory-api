'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');
const { DELIVERY_STATUSES, DELIVERY_STATUS } = require('../inventory.constants');

const DeliveryItemSchema = new mongoose.Schema({
  productId: { type: Number, required: true, min: 1 },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const DeliverySchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  // Venta asociada (opcional; en esta fase la gestión logística es independiente).
  saleId: { type: Number, default: null, index: true },
  customerId: { type: Number, required: true, min: 1, index: true },
  customerSnapshot: {
    name: { type: String, required: true },
    phone: { type: String, default: '' },
  },
  address: { type: String, required: true, trim: true, maxlength: 300 },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  items: { type: [DeliveryItemSchema], required: true },
  total: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true, default: '', maxlength: 1000 },

  status: { type: String, enum: DELIVERY_STATUSES, default: DELIVERY_STATUS.PENDING, index: true },

  // Domiciliario asignado (empleado rol courier).
  courierId: { type: Number, default: null, index: true },
  courierSnapshot: { name: { type: String, default: '' } },

  // Hitos de negocio (distintos de createdAt/updatedAt de auditoría).
  timeline: {
    dispatchedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },

  // Evidencia de entrega (opcional).
  proof: {
    photo: { url: { type: String, default: '' }, storageKey: { type: String, default: '' } },
    signature: { url: { type: String, default: '' }, storageKey: { type: String, default: '' } },
    observation: { type: String, trim: true, default: '', maxlength: 1000 },
  },
});

DeliverySchema.index({ userId: 1, status: 1, createdAt: -1 });
DeliverySchema.index({ userId: 1, courierId: 1, status: 1 });
DeliverySchema.index({ userId: 1, customerId: 1, createdAt: -1 });

module.exports = mongoose.model('inventory_deliveries', DeliverySchema);
