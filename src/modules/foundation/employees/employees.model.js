'use strict';

const { mongoose, applyPlatformSchema, RECORD_STATUS } = require('nemkit');
const {
  EMPLOYEE_ROLES,
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE,
} = require('./employees.constants');

/**
 * Empleado CON autenticación propia. Vive en su colección (separada de `users`,
 * que es solo para empresas). Se autentica con su email+passwordHash y, al
 * iniciar sesión, opera sobre la empresa (empresa) a la que pertenece.
 */
const EmployeeSchema = applyPlatformSchema({
  // Empresa (empresa) dueña del empleado.
  userId: { type: Number, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: EMPLOYEE_ROLES, required: true },
  status: { type: String, enum: EMPLOYEE_STATUSES, default: EMPLOYEE_STATUS.ACTIVE, index: true },
  documentType: { type: String, enum: DOCUMENT_TYPES, default: DOCUMENT_TYPE.CC },
  documentNumber: { type: String, trim: true, default: '', maxlength: 40 },
  phone: { type: String, trim: true, default: '', maxlength: 40 },
  hireDate: { type: Date, default: Date.now },
  photo: {
    url: { type: String, default: '' },
    storageKey: { type: String, default: '' },
  },
  security: {
    loginAttempts: { type: Number, default: 0 },
    lastLockedAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    mustChangePassword: { type: Boolean, default: false },
    passwordResetToken: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
  },
});

// Email único GLOBAL entre empleados no eliminados (independiente de users).
EmployeeSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recordStatus: { $in: [RECORD_STATUS.ACTIVE, RECORD_STATUS.INACTIVE, RECORD_STATUS.ARCHIVED] },
    },
  },
);
// Documento único por empresa (si se diligencia).
EmployeeSchema.index(
  { userId: 1, documentNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE, documentNumber: { $gt: '' } },
  },
);
EmployeeSchema.index({ userId: 1, role: 1, status: 1, name: 1 });
EmployeeSchema.index({ userId: 1, phone: 1 });

module.exports = mongoose.model('foundation_employees', EmployeeSchema);
