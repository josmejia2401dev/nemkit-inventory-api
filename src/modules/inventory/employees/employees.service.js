'use strict';

const { BaseService, HttpError, RECORD_STATUS, hashPassword, UniqueNumberUtil } = require('nemkit');
const { EmployeesRepository } = require('./employees.repository');
const User = require('../../foundation/users/users.model');
const { pagination, positiveInteger, escapeRegex, assertNoEmptyUpdate } = require('../validation');
const {
  EMPLOYEE_ROLES,
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUSES,
  EMPLOYEE_ROLE_TO_USER_ROLES,
} = require('../inventory.constants');

const UPDATABLE_FIELDS = Object.freeze([
  'name', 'documentType', 'documentNumber', 'phone', 'email', 'role', 'hireDate', 'status', 'photo',
]);

class EmployeesService extends BaseService {
  constructor() {
    super(new EmployeesRepository());
    this.notFoundMessage = 'Employee not found';
  }

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };

    if (query.role !== undefined) {
      if (!EMPLOYEE_ROLES.includes(query.role)) {
        throw HttpError.badRequest(`role must be one of: ${EMPLOYEE_ROLES.join(', ')}`);
      }
      filter.role = query.role;
    }

    if (query.status !== undefined) {
      if (!EMPLOYEE_STATUSES.includes(query.status)) {
        throw HttpError.badRequest(`status must be one of: ${EMPLOYEE_STATUSES.join(', ')}`);
      }
      filter.status = query.status;
    }

    if (query.search !== undefined) {
      if (typeof query.search !== 'string' || query.search.length > 100) {
        throw HttpError.badRequest('search must be a string of at most 100 characters');
      }
      if (query.search.trim()) {
        const value = escapeRegex(query.search.trim());
        return this.filterAndPaginate(filter, {
          page,
          limit,
          search: { value, fields: ['name', 'documentNumber', 'email', 'phone'] },
          sort: { name: 1 },
        });
      }
    }

    return this.filterAndPaginate(filter, { page, limit, sort: { name: 1 } });
  }

  /**
   * Lista ligera de empleados activos para selectores (quién vende, quién
   * entrega). Devuelve solo id, nombre y rol. Es consulta, no gestión: por eso
   * se expone en un recurso aparte accesible a los roles que registran ventas.
   */
  async options(userId, query = {}) {
    const filter = { userId, status: EMPLOYEE_STATUS.ACTIVE, recordStatus: RECORD_STATUS.ACTIVE };
    if (query.role !== undefined) {
      if (!EMPLOYEE_ROLES.includes(query.role)) {
        throw HttpError.badRequest(`role must be one of: ${EMPLOYEE_ROLES.join(', ')}`);
      }
      filter.role = query.role;
    }
    const employees = await this.repository.model
      .find(filter)
      .select('_id name role')
      .sort({ name: 1 })
      .limit(500)
      .lean();
    return employees.map((e) => ({ id: e._id, name: e.name, role: e.role }));
  }

  async getOwned(id, userId) {
    const employeeId = positiveInteger(id, 'employeeId');
    const employee = await this.findOne({
      _id: employeeId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });
    if (!employee) throw HttpError.notFound('Employee not found');
    return employee;
  }

  /**
   * Crea un empleado junto con su cuenta de login en una sola transacción.
   * El empleado queda activo y puede iniciar sesión de inmediato con el
   * email/contraseña asignados por el admin. No se fuerza cambio de contraseña.
   *
   * @param {Object} data - datos del empleado (incluye password en texto plano)
   * @param {number} userId - id de la cuenta/admin que crea al empleado
   */
  async create(data, userId) {
    const { password, ...employeeData } = data;
    const email = String(employeeData.email ?? '').trim().toLowerCase();
    employeeData.email = email;

    if (!email) throw HttpError.badRequest('email is required to create the employee login');
    if (typeof password !== 'string' || password.length < 6) {
      throw HttpError.badRequest('password must be at least 6 characters');
    }

    const userRoles = EMPLOYEE_ROLE_TO_USER_ROLES[employeeData.role];
    if (!userRoles) throw HttpError.badRequest('Invalid employee role');

    const existingUser = await User.findOne({ email, recordStatus: { $ne: RECORD_STATUS.DELETED } }).lean();
    if (existingUser) throw HttpError.conflict('Email already registered');

    const passwordHash = await hashPassword(password);

    try {
      return await this.repository.withTransaction(async (session) => {
        const loginUserId = UniqueNumberUtil.generateRaw();
        await User.create([{
          _id: loginUserId,
          fullName: employeeData.name,
          email,
          passwordHash,
          roles: userRoles,
          tenantId: userId, // userId aquí es el tenant/empresa (scoping del router)
          security: { mustChangePassword: false },
          createdBy: userId,
          updatedBy: userId,
        }], { session });

        const employeeId = UniqueNumberUtil.generateRaw();
        const [employee] = await this.repository.model.create([{
          _id: employeeId,
          ...employeeData,
          userId,
          linkedUserId: loginUserId,
          createdBy: userId,
          updatedBy: userId,
        }], { session });

        await User.updateOne({ _id: loginUserId }, { employeeId }, { session });

        return this.repository.normalizeOutput(employee);
      });
    } catch (error) {
      if (error?.code === 11000) {
        if (String(error?.message ?? '').includes('email')) {
          throw HttpError.conflict('Email already registered');
        }
        throw HttpError.conflict('Employee document number already exists');
      }
      throw error;
    }
  }

  async update(id, data, userId) {
    const employeeId = positiveInteger(id, 'employeeId');
    const current = await this.getOwned(employeeId, userId);
    assertNoEmptyUpdate(data, UPDATABLE_FIELDS);

    // Validar el nuevo rol si viene.
    if (data.role !== undefined && !EMPLOYEE_ROLE_TO_USER_ROLES[data.role]) {
      throw HttpError.badRequest('Invalid employee role');
    }

    try {
      const employee = await this.updateById(employeeId, data, userId);

      // Sincronizar el acceso del empleado: si cambió el rol, actualizar los
      // roles del usuario de login vinculado para que sus permisos coincidan.
      if (data.role !== undefined && data.role !== current.role && current.linkedUserId) {
        await User.updateOne(
          { _id: current.linkedUserId },
          { roles: EMPLOYEE_ROLE_TO_USER_ROLES[data.role], updatedBy: userId },
        );
      }
      // Si se inactiva el empleado, inactivar también su acceso.
      if (data.status === EMPLOYEE_STATUS.INACTIVE && current.linkedUserId) {
        await User.updateOne(
          { _id: current.linkedUserId },
          { recordStatus: RECORD_STATUS.INACTIVE, updatedBy: userId },
        );
      } else if (data.status === EMPLOYEE_STATUS.ACTIVE && current.linkedUserId) {
        await User.updateOne(
          { _id: current.linkedUserId },
          { recordStatus: RECORD_STATUS.ACTIVE, updatedBy: userId },
        );
      }

      return employee;
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('Employee document number already exists');
      throw error;
    }
  }

  async remove(id, userId) {
    const employeeId = positiveInteger(id, 'employeeId');
    const current = await this.getOwned(employeeId, userId);
    // Eliminar el empleado desactiva su acceso al sistema (login vinculado).
    if (current.linkedUserId) {
      await User.updateOne(
        { _id: current.linkedUserId },
        { recordStatus: RECORD_STATUS.DELETED, updatedBy: userId },
      );
    }
    return this.softDelete(employeeId, userId);
  }
}

module.exports = { EmployeesService, employeesService: new EmployeesService() };
