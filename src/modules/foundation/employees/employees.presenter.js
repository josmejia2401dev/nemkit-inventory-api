'use strict';

function presentEmployee(employee, companyName = '', businessType = 'retail') {
  return {
    id: employee.id ?? employee._id,
    fullName: employee.name,
    email: employee.email,
    roles: [String(employee.role ?? '').toUpperCase()],
    phone: employee.phone ?? '',
    documentType: employee.documentType ?? '',
    documentNumber: employee.documentNumber ?? '',
    role: employee.role,
    isOwner: false,
    isEmployee: true,
    status: employee.status,
    recordStatus: employee.recordStatus,
    userId: employee.userId,
    companyName: companyName || `Empresa #${employee.userId}`,
    businessType,
    createdAt: employee.createdAt,
  };
}

module.exports = { presentEmployee };
