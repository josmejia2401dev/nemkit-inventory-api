'use strict';

const { mongoose, applyPlatformSchema, RECORD_STATUS } = require('nemkit');
const {
  EMPLOYEE_ROLES,
  DOCUMENT_TYPES,
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS,
  DOCUMENT_TYPE,
} = require('../inventory.constants');

const EmployeeSchema = applyPlatformSchema({
  // Cuenta/negocio dueña del registro (userId del admin principal).
  userId: { type: Number, required: true, index: true },
  // Cuenta de login vinculada (null = empleado sin acceso al sistema).
  linkedUserId: { type: Number, default: null, index: true },
  formerUserId: { type: Number, default: null, index: true },
  disassociatedAt: { type: Date, default: null },
  disassociatedBy: { type: Number, default: null },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  documentType: { type: String, enum: DOCUMENT_TYPES, default: DOCUMENT_TYPE.CC },
  documentNumber: { type: String, trim: true, default: '', maxlength: 40 },
  phone: { type: String, trim: true, default: '', maxlength: 40 },
  email: { type: String, trim: true, lowercase: true, default: '', maxlength: 254 },
  role: { type: String, enum: EMPLOYEE_ROLES, required: true },
  hireDate: { type: Date, default: Date.now },
  status: { type: String, enum: EMPLOYEE_STATUSES, default: EMPLOYEE_STATUS.ACTIVE },
  photo: {
    url: { type: String, default: '' },
    storageKey: { type: String, default: '' },
  },
});

EmployeeSchema.index({ userId: 1, role: 1, status: 1, name: 1 });
EmployeeSchema.index({ userId: 1, documentNumber: 1 }, {
  unique: true,
  partialFilterExpression: { recordStatus: RECORD_STATUS.ACTIVE, documentNumber: { $gt: '' } },
});
EmployeeSchema.index({ userId: 1, phone: 1 });

module.exports = mongoose.model('inventory_employees', EmployeeSchema);
