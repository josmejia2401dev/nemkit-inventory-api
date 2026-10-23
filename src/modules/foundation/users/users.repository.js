'use strict';

const { MongoRepository } = require('nemkit');
const User = require('./users.model');

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

  /**
   * Listado GLOBAL de usuarios (uso exclusivo del super admin). No acota por
   * tenant. Soporta filtro por rol, por tipo (dueños vs empleados) y búsqueda.
   */
  async listGlobal({ page = 1, limit = 20, search = null, role = null, kind = null } = {}) {
    const filter = {};
    if (role) filter.roles = role;
    if (kind === 'owner') filter.employeeId = null;
    if (kind === 'employee') filter.employeeId = { $ne: null };
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
    const filter = { employeeId: null };
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
}

module.exports = { UsersRepository };
