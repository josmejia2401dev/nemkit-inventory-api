'use strict';

const { BaseService, HttpError, RECORD_STATUS, UniqueNumberUtil } = require('nemkit');
const { EmployeesRepository } = require('./employees.repository');
const { usersService } = require('../../foundation/users/users.service');
const { tokensService } = require('../../foundation/tokens/tokens.service');
const { pagination, positiveInteger, escapeRegex, assertNoEmptyUpdate } = require('../validation');
const {
  EMPLOYEE_ROLE,
  EMPLOYEE_ROLES,
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUSES,
  EMPLOYEE_ROLE_TO_USER_ROLES,
} = require('../inventory.constants');
const { ACCOUNT_TYPE } = require('../../foundation/users/users.constants');

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
    const employees = await this.repository.findOptions(filter);
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

  async resolveTenantForAccount(userId, employeeId) {
    const employee = await this.repository.findActiveAssociationForUser(userId, employeeId);
    if (!employee) {
      throw HttpError.forbidden('This employee account is not actively associated with a company');
    }
    return employee.userId;
  }

  async resolveResponsible(userId, employeeId, session = null) {
    if (employeeId == null || employeeId === '') {
      return { employeeId: null, employeeSnapshot: { name: '' } };
    }

    const id = positiveInteger(employeeId, 'employeeId');
    const employee = await this.repository.findActiveResponsible(userId, id, session);
    if (!employee) throw HttpError.badRequest('Invalid or inactive employeeId');

    return {
      employeeId: employee._id,
      employeeSnapshot: { name: employee.name },
    };
  }

  async getActiveCourierSnapshot(userId, courierId, session = null) {
    const id = positiveInteger(courierId, 'courierId');
    const courier = await this.repository.findActiveCourier(userId, id, session);

    if (!courier) {
      throw HttpError.badRequest('Invalid or inactive courier (must be an active employee with courier role)');
    }

    return {
      courierId: courier._id,
      courierSnapshot: { name: courier.name },
    };
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

    try {
      return await this.repository.withTransaction(async (session) => {
        const employeeId = UniqueNumberUtil.generateRaw();
        const loginUser = await usersService.createEmployeeAccount({
          fullName: employeeData.name,
          email,
          password,
          roles: userRoles,
          tenantId: userId,
          employeeId,
        }, userId, session);

        const employee = await this.repository.createInSession({
          _id: employeeId,
          ...employeeData,
          userId,
          linkedUserId: loginUser.id,
          createdBy: userId,
          updatedBy: userId,
        }, session);

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

  async associateExistingUser(email, role, tenantId, actorId = tenantId) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    if (!normalizedEmail) throw HttpError.badRequest('email is required');
    const userRoles = EMPLOYEE_ROLE_TO_USER_ROLES[role];
    if (!userRoles) throw HttpError.badRequest('Invalid employee role');

    const company = await usersService.getById(tenantId);
    const isCompanyOwner = company.accountType === ACCOUNT_TYPE.COMPANY_OWNER
      || (
        company.accountType == null
        && company.employeeId == null
        && !company.roles?.includes('SUPERADMIN')
      );
    if (
      !isCompanyOwner
      || (company.tenantId ?? company.id) !== tenantId
      || company.recordStatus !== RECORD_STATUS.ACTIVE
    ) {
      throw HttpError.badRequest('The account does not represent an active company');
    }

    return this.repository.withTransaction(async (session) => {
      const availableUser = await usersService.findAvailableEmployeeByEmail(normalizedEmail, session);
      if (!availableUser) {
        throw HttpError.notFound('No unassociated employee account was found for this email');
      }

      const employeeId = UniqueNumberUtil.generateRaw();
      const user = await usersService.associateUnassignedEmployee(availableUser.id, {
        tenantId,
        employeeId,
        roles: userRoles,
      }, actorId, session);
      await tokensService.revokeAllSessions(user.id, session);

      const employee = await this.repository.createInSession({
        _id: employeeId,
        userId: tenantId,
        linkedUserId: user.id,
        name: user.fullName,
        email: user.email,
        role,
        status: EMPLOYEE_STATUS.ACTIVE,
        createdBy: actorId,
        updatedBy: actorId,
      }, session);

      return this.repository.normalizeOutput(employee);
    });
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
        await usersService.updateEmployeeAccount(current.linkedUserId, {
          roles: EMPLOYEE_ROLE_TO_USER_ROLES[data.role],
        }, userId);
        await tokensService.revokeAllSessions(current.linkedUserId);
      }
      // Si se inactiva el empleado, inactivar también su acceso.
      if (data.status === EMPLOYEE_STATUS.INACTIVE && current.linkedUserId) {
        await usersService.updateEmployeeAccount(current.linkedUserId, {
          recordStatus: RECORD_STATUS.INACTIVE,
        }, userId);
        await tokensService.revokeAllSessions(current.linkedUserId);
      } else if (data.status === EMPLOYEE_STATUS.ACTIVE && current.linkedUserId) {
        await usersService.updateEmployeeAccount(current.linkedUserId, {
          recordStatus: RECORD_STATUS.ACTIVE,
        }, userId);
      }

      return employee;
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('Employee document number already exists');
      throw error;
    }
  }

  async remove(id, userId, actorId = userId) {
    const employeeId = positiveInteger(id, 'employeeId');
    return this.repository.withTransaction(async (session) => {
      const current = await this.repository.findInSession({
        _id: employeeId,
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
      }, session);
      if (!current) throw HttpError.notFound('Employee not found');

      if (current.linkedUserId) {
        await usersService.disassociateEmployee(
          current.linkedUserId,
          userId,
          employeeId,
          actorId,
          session,
        );
        await tokensService.revokeAllSessions(current.linkedUserId, session);
      }

      const employee = await this.repository.endAssociation(
        employeeId,
        userId,
        current.linkedUserId,
        actorId,
        session,
      );
      if (!employee) throw HttpError.conflict('Employee association changed; retry the operation');
      return employee;
    });
  }

  async disassociateUser(userId, tenantId, actorId = tenantId) {
    const accountId = positiveInteger(userId, 'userId');
    return this.repository.withTransaction(async (session) => {
      const employee = await this.repository.findInSession({
        userId: tenantId,
        linkedUserId: accountId,
        recordStatus: RECORD_STATUS.ACTIVE,
      }, session);
      if (!employee) throw HttpError.notFound('Associated employee account not found');

      await usersService.disassociateEmployee(accountId, tenantId, employee._id, actorId, session);
      await tokensService.revokeAllSessions(accountId, session);
      const result = await this.repository.endAssociation(employee._id, tenantId, accountId, actorId, session);
      if (!result) throw HttpError.conflict('Employee association changed; retry the operation');
      return result;
    });
  }

  listAccountHistory(userId) {
    return this.repository.listAccountHistory(positiveInteger(userId, 'userId'));
  }
}

module.exports = { EmployeesService, employeesService: new EmployeesService() };
