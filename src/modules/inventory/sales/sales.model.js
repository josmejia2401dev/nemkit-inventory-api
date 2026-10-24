'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');
const { DOCUMENT_STATUS, ORDER_STATUSES } = require('../inventory.constants');

const SaleItemSchema = new mongoose.Schema({
  productId: { type: Number, required: true, min: 1 },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  unitPrice: { type: Number, required: true, min: 0 },
  unitCost: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const SaleSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  customerId: { type: Number, required: true, min: 1, index: true },
  customerSnapshot: {
    name: { type: String, required: true },
    document: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  employeeId: { type: Number, default: null, index: true },
  employeeSnapshot: { name: { type: String, default: '' } },
  // Restaurante: comanda en cocina. null = venta normal (no pasa por cocina).
  kitchenStatus: { type: String, enum: ['pending', 'preparing', 'ready', 'served'], default: null, index: true },
  orderStatus: { type: String, enum: ORDER_STATUSES, default: null, index: true },
  orderChannel: { type: String, enum: ['delivery', 'on_site'], default: 'on_site', index: true },
  tableNumber: { type: String, trim: true, default: '', maxlength: 20 },
  kitchenTimeline: {
    startedAt: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    servedAt: { type: Date, default: null },
  },
  date: { type: Date, required: true, index: true },
  status: { type: String, enum: Object.values(DOCUMENT_STATUS), default: DOCUMENT_STATUS.COMPLETED },
  // Cancelación del pedido/venta: motivo predefinido y nota opcional del mesero.
  voidReason: { type: String, default: '' },
  voidNote: { type: String, trim: true, default: '', maxlength: 300 },
  voidedAt: { type: Date, default: null },
  voidedBy: { type: Number, min: 1, default: null },
  voidedBySnapshot: { name: { type: String, default: '' } },
  // Estado de cobro: paid (tienda al instante; restaurante tras cobrar) o pending.
  paymentStatus: { type: String, enum: ['paid', 'pending'], default: 'paid', index: true },
  paidAt: { type: Date, default: null },
  notes: { type: String, trim: true, default: '', maxlength: 1000 },
  items: { type: [SaleItemSchema], required: true },
  total: { type: Number, required: true, min: 0 },
  movementId: { type: Number, required: true, min: 1, unique: true },
});
SaleSchema.index({ userId: 1, date: -1 });
SaleSchema.index({ userId: 1, customerId: 1, date: -1 });
SaleSchema.index({ userId: 1, employeeId: 1, date: -1 });
SaleSchema.index({ userId: 1, status: 1, voidedAt: -1 });
// Cola de cocina: comandas activas ordenadas por fecha.
SaleSchema.index({ userId: 1, kitchenStatus: 1, date: 1 });
SaleSchema.index({ userId: 1, orderStatus: 1, date: 1 });

module.exports = mongoose.model('inventory_sales', SaleSchema);
