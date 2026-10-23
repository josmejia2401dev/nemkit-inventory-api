'use strict';
const { mongoose, applyPlatformSchema, RECORD_STATUS } = require('nemkit');
const { PRODUCT_STATUS, PRODUCT_STATUSES, PRODUCT_TYPE, PRODUCT_TYPES } = require('../inventory.constants');

/** Ítem de receta: un insumo y la cantidad que consume el plato. */
const RecipeItemSchema = new mongoose.Schema({
  ingredientId: { type: Number, required: true, min: 1 },
  quantity: { type: Number, required: true, min: 0 }, // permite decimales (gramos/ml)
}, { _id: false });

const ProductSchema = applyPlatformSchema({
  userId: { type: Number, required: true, index: true },
  categoryId: { type: Number, required: true, min: 1, index: true },
  type: { type: String, enum: PRODUCT_TYPES, default: PRODUCT_TYPE.SIMPLE, index: true },
  sku: { type: String, required: true, trim: true, uppercase: true },
  barcode: { type: String, trim: true, default: '' },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, default: '', maxlength: 2000 },
  // Precio de compra OPCIONAL: los platos no se compran (su costo sale de la
  // receta) y algunos negocios no lo registran. Por defecto 0.
  purchasePrice: { type: Number, default: 0, min: 0 },
  salePrice: { type: Number, required: true, min: 0 },
  // Stock: los insumos permiten decimales (gramos/ml); simple usa enteros desde la app.
  // Los platos (prepared) no usan stock propio (su disponibilidad deriva de los insumos).
  stock: { type: Number, default: 0, min: 0 },
  minimumStock: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: PRODUCT_STATUSES, default: PRODUCT_STATUS.ACTIVE },
  // Receta (solo para type = prepared): insumos y cantidades que consume.
  recipe: { type: [RecipeItemSchema], default: [] },
  image: { url: { type: String, default: '' }, storageKey: { type: String, default: '' } },
});
ProductSchema.index({ userId: 1, sku: 1 }, { unique: true, partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE } });
ProductSchema.index({ userId: 1, barcode: 1 }, { unique: true, partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE, barcode: { $gt: '' } } });
ProductSchema.index({ userId: 1, status: 1, categoryId: 1, name: 1 });
ProductSchema.index({ userId: 1, type: 1, status: 1, name: 1 });
module.exports = mongoose.model('inventory_products', ProductSchema);
