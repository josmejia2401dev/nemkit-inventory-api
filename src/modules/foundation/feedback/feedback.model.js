'use strict';

const { mongoose, applyPlatformSchema } = require('nemkit');
const { FEEDBACK_TYPE, FEEDBACK_TYPES, FEEDBACK_STATUS, FEEDBACK_STATUSES } = require('./feedback.constants');

/**
 * Reporte transversal de bugs/hallazgos/sugerencias. Lo crea cualquier usuario
 * autenticado y lo revisa el super admin (global, no acotado por empresa). Por
 * eso guarda un snapshot de quién reportó y desde qué empresa (empresa).
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
  title: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: FEEDBACK_STATUSES, default: FEEDBACK_STATUS.OPEN, index: true },
});

FeedbackSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('feedback', FeedbackSchema);
