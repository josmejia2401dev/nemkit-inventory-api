'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');
const {
  LAYAWAY_FREQUENCIES,
  LAYAWAY_CANCELLATION_POLICIES,
  LAYAWAY_DEFAULT_SETTINGS,
} = require('../inventory.constants');

/** Configuración de Plan separe por empresa (dominio, no foundation). */
const LayawaySettingsSchema = applyPlatformSchema({
  userId: { type: Number, required: true, unique: true, index: true },
  minInitialPercent: { type: Number, default: LAYAWAY_DEFAULT_SETTINGS.minInitialPercent, min: 0, max: 100 },
  maxTermMonths: { type: Number, default: LAYAWAY_DEFAULT_SETTINGS.maxTermMonths, min: 1, max: 60 },
  defaultFrequency: { type: String, enum: LAYAWAY_FREQUENCIES, default: LAYAWAY_DEFAULT_SETTINGS.defaultFrequency },
  cancellationPolicy: { type: String, enum: LAYAWAY_CANCELLATION_POLICIES, default: LAYAWAY_DEFAULT_SETTINGS.cancellationPolicy },
  retentionPercent: { type: Number, default: LAYAWAY_DEFAULT_SETTINGS.retentionPercent, min: 0, max: 100 },
  allowImmediateHandover: { type: Boolean, default: LAYAWAY_DEFAULT_SETTINGS.allowImmediateHandover },
});

module.exports = mongoose.model('inventory_layaway_settings', LayawaySettingsSchema, 'inventory_layaway_settings');
