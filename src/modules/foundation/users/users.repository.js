'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const User = require('./users.model');
const { ACCOUNT_TYPE } = require('./users.constants');
const { applyMongoTimeout } = require('../../../config/mongo-query');

class UsersRepository extends MongoRepository {
  constructor() { super(User); }

  async findByEmail(email) {
    const doc = await this.model.findOne({ email, ...this._baseFilter() }).select('+passwordHash');
    return this.normalizeOutput(doc);
  }

  async findByIdWithPassword(id) {
    const doc = await this.model.findOne({ _id: id, ...this._baseFilter() }).select('+passwordHash');
    return this.normalizeOutput(doc);
  }

  async findByResetToken(token) {
    const doc = await this.model
      .findOne({ 'security.passwordResetToken': token, ...this._baseFilter() })
      .select('+security.passwordResetToken +security.passwordResetExpires');
    return this.normalizeOutput(doc);
  }

  async updateLoginSecurity(id, data) {
    const doc = await this.model.findOneAndUpdate({ _id: id }, data, { returnDocument: 'after' });
    return this.normalizeOutput(doc);
  }

  async createEmployeeAccount(data, actorId, session) {
    const input = this.normalizeInput(data);
    const [doc] = await this.model.create([{
      ...input,
      createdBy: actorId,
      updatedBy: actorId,
    }], { session });
    return this.normalizeOutput(doc);
  }

  async updateEmployeeAccount(id, data, actorId, session) {
    const doc = await this.model.findOneAndUpdate(
      { _id: id, ...this._baseFilter() },
      { $set: { ...data, updatedBy: actorId } },
      { returnDocument: 'after', session },
    );
    return this.normalizeOutput(doc);
  }

  async findAvailableEmployeeByEmail(email, session = null) {
    let query = this.model.findOne({
      ...this._baseFilter(),
      email,
      accountType: ACCOUNT_TYPE.UNASSIGNED_EMPLOYEE,
      employeeId: null,
      tenantId: null,
      recordStatus: RECORD_STATUS.INACTIVE,
    });
    if (session) query = query.session(session);
    return this.normalizeOutput(await query.lean());
  }

  async associateUnassignedEmployee(id, association, actorId, session) {
    const doc = await this.model.findOneAndUpdate(
      {
        ...this._baseFilter(),
        _id: id,
        accountType: ACCOUNT_TYPE.UNASSIGNED_EMPLOYEE,
        employeeId: null,
        tenantId: null,
        recordStatus: RECORD_STATUS.INACTIVE,
      },
      { $set: { ...association, updatedBy: actorId } },
      { returnDocument: 'after', session },
    );
    return this.normalizeOutput(doc);
  }

  async disassociateEmployee(id, tenantId, employeeId, actorId, session) {
    const doc = await this.model.findOneAndUpdate(
      {
        ...this._baseFilter(),
        _id: id,
        tenantId,
        employeeId,
        $or: [
          { accountType: ACCOUNT_TYPE.EMPLOYEE },
          { accountType: null },
        ],
      },
      {
        $set: {
          accountType: ACCOUNT_TYPE.UNASSIGNED_EMPLOYEE,
          recordStatus: RECORD_STATUS.INACTIVE,
          tenantId: null,
          employeeId: null,
          roles: ['USER'],
          updatedBy: actorId,
        },
      },
      { returnDocument: 'after', session },
    );
    return this.normalizeOutput(doc);
  }

  async findByIds(ids) {
    const docs = await this._applyTimeout(this.model.find({
      _id: { $in: ids },
      ...this._baseFilter(),
    }).lean());
    return docs.map((doc) => this.normalizeOutput(doc));
  }

  /**
   * Listado GLOBAL de usuarios (uso exclusivo del super admin). No acota por
   * tenant. Soporta filtro por rol, por tipo (dueños vs empleados) y búsqueda.
   */
  async listGlobal({ page = 1, limit = 20, search = null, role = null, kind = null } = {}) {
    const criteria = [];
    if (role) criteria.push({ roles: role });
    if (kind === 'owner') {
      criteria.push({ $or: [
        { accountType: ACCOUNT_TYPE.COMPANY_OWNER },
        {
          accountType: null,
          employeeId: null,
          roles: { $nin: ['SUPERADMIN'] },
        },
      ] });
    }
    if (kind === 'employee') criteria.push({ employeeId: { $ne: null } });
    if (kind === 'unassigned_employee') criteria.push({ accountType: ACCOUNT_TYPE.UNASSIGNED_EMPLOYEE });
    if (kind === 'super_admin') criteria.push({ roles: 'SUPERADMIN' });
    const filter = criteria.length ? { $and: criteria } : {};
    return this.filterAndPaginate(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      search: search ? { value: search, fields: ['fullName', 'email', 'companyName'] } : null,
    });
  }

  /**
   * Listado GLOBAL de empresas: cada empresa ES su usuario dueño (tenantId === _id).
   * Un usuario dueño no tiene employeeId.
   */
  async listOwners({ page = 1, limit = 20, search = null } = {}) {
    const filter = {
      $and: [{ $or: [
        { accountType: ACCOUNT_TYPE.COMPANY_OWNER },
        {
          accountType: null,
          employeeId: null,
          roles: { $nin: ['SUPERADMIN'] },
        },
      ] }],
    };
    return this.filterAndPaginate(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      search: search ? { value: search, fields: ['fullName', 'email', 'companyName'] } : null,
    });
  }

  /** Empleados (usuarios de login) de una empresa/tenant dada. */
  async listEmployeesOfTenant(tenantId) {
    const docs = await this.model
      .find({ tenantId, employeeId: { $ne: null }, ...this._baseFilter() })
      .sort({ createdAt: 1 })
      .lean();
    return docs.map((d) => this.normalizeOutput(d));
  }

  /** Cuenta usuarios de un tenant (dueño + empleados). */
  countByTenant(tenantId) {
    return this.model.countDocuments({ tenantId, ...this._baseFilter() });
  }

  countByTenants(tenantIds) {
    if (!tenantIds.length) return Promise.resolve([]);
    const aggregation = this.model.aggregate([
      { $match: { tenantId: { $in: tenantIds }, ...this._baseFilter() } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ]);
    return applyMongoTimeout(aggregation, this.queryTimeoutMs);
  }

}

module.exports = { UsersRepository };
