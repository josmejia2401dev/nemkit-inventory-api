'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');

/** Categorías de reporte que puede enviar un usuario. */
const FEEDBACK_TYPE = Object.freeze({
  BUG: 'bug',
  SUGGESTION: 'suggestion',
  OTHER: 'other',
});

/** Ciclo de atención del reporte por parte del super admin. */
const FEEDBACK_STATUS = Object.freeze({
  OPEN: 'open',
  REVIEWED: 'reviewed',
  RESOLVED: 'resolved',
});

const FEEDBACK_TYPES = Object.freeze(Object.values(FEEDBACK_TYPE));
const FEEDBACK_STATUSES = Object.freeze(Object.values(FEEDBACK_STATUS));

/**
 * Reporte transversal de bugs/hallazgos/sugerencias. Lo crea cualquier usuario
 * autenticado y lo revisa el super admin (global, no acotado por empresa). Por
 * eso guarda un snapshot de quién reportó y desde qué empresa (tenant).
 */
const FeedbackSchema = applyPlatformSchema({
  // Autor del reporte (usuario que inició sesión).
  userId: { type: Number, required: true, index: true },
  userSnapshot: {
    fullName: { type: String, default: '' },
    email: { type: String, default: '' },
    companyName: { type: String, default: '' },
  },
  type: { type: String, enum: FEEDBACK_TYPES, default: FEEDBACK_TYPE.BUG, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 4000 },
  status: { type: String, enum: FEEDBACK_STATUSES, default: FEEDBACK_STATUS.OPEN, index: true },
}, { tenant: true });

FeedbackSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('feedback', FeedbackSchema);
module.exports.FEEDBACK_TYPE = FEEDBACK_TYPE;
module.exports.FEEDBACK_TYPES = FEEDBACK_TYPES;
module.exports.FEEDBACK_STATUS = FEEDBACK_STATUS;
module.exports.FEEDBACK_STATUSES = FEEDBACK_STATUSES;
