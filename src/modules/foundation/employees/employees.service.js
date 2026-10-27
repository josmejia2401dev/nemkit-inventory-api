'use strict';

const { BaseService, HttpError, RECORD_STATUS, UniqueNumberUtil, hashPassword } = require('nemkit');
const { EmployeesRepository } = require('./employees.repository');
const { tokensService } = require('../tokens/tokens.service');
const { usersService } = require('../users/users.service');
const {
  EMPLOYEE_ROLE_TO_USER_ROLES,
  EMPLOYEE_ROLES,
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUSES,
} = require('./employees.constants');

const UPDATABLE_FIELDS = Object.freeze([
  'name', 'documentType', 'documentNumber', 'phone', 'role', 'hireDate', 'status', 'photo',
]);

/** Validaciones ligeras compartidas con el controller. */
function pagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}
function positiveInteger(value, field) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw HttpError.badRequest(`${field} must be a positive integer`);
  return n;
}
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class EmployeesService extends BaseService {
  constructor() {
    super(new EmployeesRepository());
    this.notFoundMessage = 'Employee not found';
  }

  async list(tenantId, query = {}) {
    const { page, limit } = pagination(query);
    const filter = { tenantId, recordStatus: RECORD_STATUS.ACTIVE };

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
    if (typeof query.search === 'string' && query.search.trim()) {
      if (query.search.length > 100) throw HttpError.badRequest('search must be at most 100 characters');
      return this.filterAndPaginate(filter, {
        page,
        limit,
        search: { value: escapeRegex(query.search.trim()), fields: ['name', 'documentNumber', 'email', 'phone'] },
        sort: { name: 1 },
      });
    }
    return this.filterAndPaginate(filter, { page, limit, sort: { name: 1 } });
  }

  /** Lista ligera de empleados activos para selectores (quién vende, quién entrega). */
  async options(tenantId, query = {}) {
    const filter = { tenantId, status: EMPLOYEE_STATUS.ACTIVE, recordStatus: RECORD_STATUS.ACTIVE };
    if (query.role !== undefined) {
      if (!EMPLOYEE_ROLES.includes(query.role)) {
        throw HttpError.badRequest(`role must be one of: ${EMPLOYEE_ROLES.join(', ')}`);
      }
      filter.role = query.role;
    }
    const employees = await this.repository.findOptions(filter);
    return employees.map((e) => ({ id: e._id, name: e.name, role: e.role }));
  }

  async getOwned(id, tenantId) {
    const employeeId = positiveInteger(id, 'employeeId');
    const employee = await this.findOne({ _id: employeeId, tenantId, recordStatus: RECORD_STATUS.ACTIVE });
    if (!employee) throw HttpError.notFound('Employee not found');
    return employee;
  }

  /**
   * Resuelve el tenant (empresa) de un empleado autenticado. Usado por el
   * scoping: garantiza que el empleado siga activo y asociado.
   */
  async resolveTenantForAccount(employeeId) {
    const employee = await this.repository.findActiveSelf(positiveInteger(employeeId, 'employeeId'));
    if (!employee) throw HttpError.forbidden('This employee account is inactive or no longer associated');
    return employee.tenantId;
  }

  /** Responsable de una operación (venta/compra/movimiento). */
  async resolveResponsible(tenantId, employeeId, session = null) {
    if (employeeId == null || employeeId === '') {
      return { employeeId: null, employeeSnapshot: { name: '' } };
    }
    const id = positiveInteger(employeeId, 'employeeId');
    const employee = await this.repository.findActiveResponsible(tenantId, id, session);
    if (!employee) throw HttpError.badRequest('Invalid or inactive employeeId');
    return { employeeId: employee._id, employeeSnapshot: { name: employee.name } };
  }

  async getActiveCourierSnapshot(tenantId, courierId, session = null) {
    const id = positiveInteger(courierId, 'courierId');
    const courier = await this.repository.findActiveCourier(tenantId, id, session);
    if (!courier) {
      throw HttpError.badRequest('Invalid or inactive courier (must be an active employee with courier role)');
    }
    return { courierId: courier._id, courierSnapshot: { name: courier.name } };
  }

  /**
   * Crea un empleado con su login propio. Email único global entre empleados.
   */
  async create(data, tenantId) {
    const { password, ...employeeData } = data;
    const email = String(employeeData.email ?? '').trim().toLowerCase();
    employeeData.email = email;

    if (!email) throw HttpError.badRequest('email is required to create the employee login');
    if (typeof password !== 'string' || password.length < 6) {
      throw HttpError.badRequest('password must be at least 6 characters');
    }
    if (!EMPLOYEE_ROLE_TO_USER_ROLES[employeeData.role]) {
      throw HttpError.badRequest('Invalid employee role');
    }
    // El correo no puede chocar con una cuenta de empresa (users).
    const companyWithEmail = await usersService.findByEmail(email);
    if (companyWithEmail) throw HttpError.conflict('Email already registered');

    const passwordHash = await hashPassword(password);
    try {
      const employee = await this.repository.create({
        _id: UniqueNumberUtil.generateRaw(),
        tenantId,
        ...employeeData,
        passwordHash,
        security: { mustChangePassword: false },
      }, tenantId);
      return employee;
    } catch (error) {
      if (error?.code === 11000) {
        if (String(error?.message ?? '').includes('documentNumber')) {
          throw HttpError.conflict('Employee document number already exists');
        }
        throw HttpError.conflict('Email already registered');
      }
      throw error;
    }
  }

  async update(id, data, tenantId) {
    const employeeId = positiveInteger(id, 'employeeId');
    const current = await this.getOwned(employeeId, tenantId);
    if (!UPDATABLE_FIELDS.some((f) => data[f] !== undefined)) {
      throw HttpError.badRequest('At least one updatable field is required');
    }
    if (data.role !== undefined && !EMPLOYEE_ROLE_TO_USER_ROLES[data.role]) {
      throw HttpError.badRequest('Invalid employee role');
    }
    try {
      const employee = await this.updateById(employeeId, data, tenantId);
      // Si cambia el rol o se inactiva, revocar las sesiones activas del empleado
      // para que un token viejo no conserve permisos o acceso indebidos.
      const roleChanged = data.role !== undefined && data.role !== current.role;
      const deactivated = data.status === EMPLOYEE_STATUS.INACTIVE;
      if (roleChanged || deactivated) {
        await tokensService.revokeAllSessions(employeeId);
      }
      return employee;
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('Employee document number already exists');
      throw error;
    }
  }

  /** Baja lógica del empleado: pierde acceso al sistema. */
  async remove(id, tenantId, actorId = tenantId) {
    const employeeId = positiveInteger(id, 'employeeId');
    await this.getOwned(employeeId, tenantId);
    const employee = await this.softDelete(employeeId, actorId);
    await tokensService.revokeAllSessions(employeeId);
    return employee;
  }

  async changePassword(employeeId, newPlainPassword) {
    const passwordHash = await hashPassword(newPlainPassword);
    return this.updateById(employeeId, { passwordHash }, employeeId);
  }

  // ── Consultas para el panel de plataforma (super admin) ────────────────
  async listByTenant(tenantId) {
    const result = await this.filterAndPaginate(
      { tenantId, recordStatus: RECORD_STATUS.ACTIVE },
      { page: 1, limit: 500, sort: { name: 1 } },
    );
    return result.data;
  }

  countByTenant(tenantId) {
    return this.repository.countDocuments({ tenantId, recordStatus: RECORD_STATUS.ACTIVE });
  }

  async countByTenants(tenantIds) {
    if (!tenantIds.length) return [];
    return this.repository.aggregate([
      { $match: { tenantId: { $in: tenantIds }, recordStatus: RECORD_STATUS.ACTIVE } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ]);
  }

  // Accesos directos al repositorio para el flujo de autenticación.
  findByEmailWithPassword(email) { return this.repository.findByEmailWithPassword(email); }
  findByIdWithPassword(id) { return this.repository.findByIdWithPassword(id); }
  findByResetToken(token) { return this.repository.findByResetToken(token); }
  updateLoginSecurity(id, data) { return this.repository.updateLoginSecurity(id, data); }
}

module.exports = { EmployeesService, employeesService: new EmployeesService() };
