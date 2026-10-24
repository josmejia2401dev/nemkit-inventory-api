'use strict';

const { BaseService, HttpError, hashPassword, UniqueNumberUtil, RECORD_STATUS } = require('nemkit');
const { UsersRepository } = require('./users.repository');
const { ACCOUNT_TYPE } = require('./users.constants');

class UsersService extends BaseService {
  constructor() {
    super(new UsersRepository());
    this.notFoundMessage = 'User not found';
  }

  async getById(id) {
    const user = await this.findById(id);
    if (!user) throw HttpError.notFound('User not found');
    return user;
  }

  /**
   * Registro público: crea el dueño de una cuenta. Su tenant es él mismo,
   * de modo que se convierte en el silo de datos de su propia empresa.
   */
  async create(payload, userId = null) {
    const email = String(payload.email ?? '').trim().toLowerCase();
    if (!email) throw HttpError.badRequest('email is required');
    const existing = await this.repository.findByEmail(email);
    if (existing) throw HttpError.conflict('Email already registered');
    const passwordHash = await hashPassword(payload.password);
    const ownerId = UniqueNumberUtil.generateRaw();
    try {
      return await this.repository.create(
        {
          _id: ownerId,
          tenantId: ownerId,
          accountType: ACCOUNT_TYPE.COMPANY_OWNER,
          fullName: payload.fullName,
          email,
          companyName: payload.companyName ?? '',
          businessType: payload.businessType === 'restaurant' ? 'restaurant' : 'retail',
          passwordHash,
          roles: ['ADMIN'],
          security: { mustChangePassword: false },
        },
        userId,
      );
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('Email already registered');
      throw error;
    }
  }

  async createEmployeeAccount(payload, actorId, session) {
    const email = String(payload.email ?? '').trim().toLowerCase();
    const fullName = String(payload.fullName ?? '').trim();
    if (!email || !fullName) throw HttpError.badRequest('Employee name and email are required');
    if (typeof payload.password !== 'string' || payload.password.length < 6) {
      throw HttpError.badRequest('password must be at least 6 characters');
    }
    if (!Number.isInteger(payload.tenantId) || payload.tenantId < 1) {
      throw HttpError.badRequest('tenantId must be a positive integer');
    }
    if (!Number.isInteger(payload.employeeId) || payload.employeeId < 1) {
      throw HttpError.badRequest('employeeId must be a positive integer');
    }
    if (!Array.isArray(payload.roles) || payload.roles.length === 0) {
      throw HttpError.badRequest('At least one user role is required');
    }

    const passwordHash = await hashPassword(payload.password);
    try {
      return await this.repository.createEmployeeAccount({
        _id: UniqueNumberUtil.generateRaw(),
        fullName,
        email,
        passwordHash,
        roles: payload.roles,
        accountType: ACCOUNT_TYPE.EMPLOYEE,
        tenantId: payload.tenantId,
        employeeId: payload.employeeId,
        security: { mustChangePassword: false },
      }, actorId, session);
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('Email already registered');
      throw error;
    }
  }

  async updateEmployeeAccount(id, data, actorId, session) {
    const update = {};
    if (data.roles !== undefined) {
      if (!Array.isArray(data.roles) || data.roles.length === 0) {
        throw HttpError.badRequest('At least one user role is required');
      }
      update.roles = data.roles;
    }
    if (data.recordStatus !== undefined) {
      if (!Object.values(RECORD_STATUS).includes(data.recordStatus)) {
        throw HttpError.badRequest('Invalid user status');
      }
      update.recordStatus = data.recordStatus;
    }
    if (!Object.keys(update).length) return null;
    return this.repository.updateEmployeeAccount(id, update, actorId, session);
  }

  findAvailableEmployeeByEmail(email, session = null) {
    return this.repository.findAvailableEmployeeByEmail(String(email ?? '').trim().toLowerCase(), session);
  }

  async associateUnassignedEmployee(id, association, actorId, session) {
    const user = await this.repository.associateUnassignedEmployee(id, {
      accountType: ACCOUNT_TYPE.EMPLOYEE,
      recordStatus: RECORD_STATUS.ACTIVE,
      tenantId: association.tenantId,
      employeeId: association.employeeId,
      roles: association.roles,
    }, actorId, session);
    if (!user) throw HttpError.conflict('This account is no longer available for association');
    return user;
  }

  async disassociateEmployee(id, tenantId, employeeId, actorId, session) {
    const user = await this.repository.disassociateEmployee(id, tenantId, employeeId, actorId, session);
    if (!user) throw HttpError.conflict('This employee account is no longer associated with this company');
    return user;
  }

  findByEmail(email) { return this.repository.findByEmail(email); }
  findByIdWithPassword(id) { return this.repository.findByIdWithPassword(id); }
  findByResetToken(token) { return this.repository.findByResetToken(token); }
  updateLoginSecurity(id, data) { return this.repository.updateLoginSecurity(id, data); }

  // ── Operaciones de plataforma (super admin, globales) ──────────────────
  listGlobal(options) { return this.repository.listGlobal(options); }
  listOwners(options) { return this.repository.listOwners(options); }
  listEmployeesOfTenant(tenantId) { return this.repository.listEmployeesOfTenant(tenantId); }
  countByTenant(tenantId) { return this.repository.countByTenant(tenantId); }
  countByTenants(tenantIds) { return this.repository.countByTenants(tenantIds); }
  findByIds(ids) { return this.repository.findByIds(ids); }
  listActiveNotificationRecipientsAfter(id, limit) {
    return this.repository.listActiveNotificationRecipientsAfter(id, limit);
  }

  async changePassword(userId, newPlainPassword) {
    const passwordHash = await hashPassword(newPlainPassword);
    return this.updateById(userId, { passwordHash }, userId);
  }
}

module.exports = { UsersService, usersService: new UsersService() };
