'use strict';

const { createValidator } = require('nemkit');

// Actualización PARCIAL del perfil de empresa: todos los campos son opcionales
// (permite editar solo el negocio, o solo nombre/correo). El controller exige
// que venga al menos uno.
const profileSchema = createValidator({
  fullName: { type: 'string', trim: true, minLength: 2, maxLength: 100 },
  email: { type: 'email', trim: true, lowercase: true, maxLength: 254 },
  // Datos del negocio (empresa): se editan desde el propio perfil del dueño.
  companyName: { type: 'string', trim: true, maxLength: 100 },
  businessType: { type: 'string', enum: ['retail', 'restaurant'] },
});

const passwordSchema = createValidator({
  currentPassword: { type: 'string', required: true, minLength: 1, maxLength: 128 },
  newPassword: { type: 'string', required: true, minLength: 6, maxLength: 128 },
});

module.exports = { profileSchema, passwordSchema };
