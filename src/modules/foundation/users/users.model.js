'use strict';

const { mongoose, applyPlatformSchema, RECORD_STATUS } = require('nemkit');

const UserSchema = applyPlatformSchema({
  fullName:     { type: String, required: true, trim: true },
  email:        { type: String, required: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  roles:        [{ type: String, enum: ['SUPERADMIN', 'ADMIN', 'USER', 'CASHIER', 'SELLER', 'COURIER', 'WAREHOUSE', 'WAITER', 'COOK'], default: 'USER' }],
  // Nombre de la empresa (solo lo diligencia el dueño de la cuenta).
  companyName:  { type: String, trim: true, default: '', maxlength: 160 },
  // Tipo de negocio del dueño: activa funciones específicas (p. ej. cocina).
  businessType: { type: String, enum: ['retail', 'restaurant'], default: 'retail' },
  // Empleado vinculado (si el usuario es un acceso creado para un empleado).
  employeeId:   { type: Number, default: null, index: true },
  security: {
    loginAttempts:      { type: Number, default: 0 },
    lastLockedAt:       { type: Date, default: null },
    lockedUntil:        { type: Date, default: null },
    lastLoginAt:        { type: Date, default: null },
    mustChangePassword: { type: Boolean, default: false },
    passwordResetToken: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
  },
}, { tenant: true });

// Email único entre usuarios no eliminados. Parcial para permitir reutilizar el
// email de una cuenta dada de baja lógicamente, sin chocar con el borrado suave.
// Los índices parciales de MongoDB no admiten $ne; se listan los estados vigentes.
UserSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recordStatus: {
        $in: [RECORD_STATUS.ACTIVE, RECORD_STATUS.INACTIVE, RECORD_STATUS.ARCHIVED],
      },
    },
  },
);

module.exports = mongoose.model('users', UserSchema);
