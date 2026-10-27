'use strict';

const { HttpError, hashPassword, comparePassword } = require('nemkit');
const { employeesService } = require('../employees/employees.service');

/**
 * Perfil del EMPLEADO autenticado: consulta y edita sus propios datos y cambia
 * su contraseña. Opera sobre su registro en foundation_employees (no sobre la
 * empresa). El cargo (role) lo administra la empresa, no el empleado.
 */
class EmployeesProfileService {
  async get(employeeId) {
    const employee = await employeesService.findById(employeeId);
    if (!employee) throw HttpError.notFound('Employee not found');
    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone ?? '',
      role: employee.role,
      documentType: employee.documentType ?? null,
      documentNumber: employee.documentNumber ?? '',
      status: employee.status,
      security: {
        lastLoginAt: employee.security?.lastLoginAt ?? null,
        mustChangePassword: employee.security?.mustChangePassword ?? false,
      },
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }

  async update(employeeId, data) {
    try {
      const employee = await employeesService.updateById(employeeId, data, employeeId);
      return { name: employee.name, email: employee.email, phone: employee.phone ?? '' };
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('Email already registered');
      throw error;
    }
  }

  async changePassword(employeeId, currentPassword, newPassword) {
    const employee = await employeesService.findByIdWithPassword(employeeId);
    if (!employee || !(await comparePassword(currentPassword, employee.passwordHash))) {
      throw HttpError.badRequest('Current password is incorrect');
    }
    const passwordHash = await hashPassword(newPassword);
    await employeesService.updateById(employeeId, { passwordHash }, employeeId);
  }
}

module.exports = { EmployeesProfileService, employeesProfileService: new EmployeesProfileService() };
