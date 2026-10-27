'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Employee = require('./employees.model');
const { EMPLOYEE_ROLE, EMPLOYEE_STATUS } = require('./employees.constants');

class EmployeesRepository extends MongoRepository {
  constructor() {
    super(Employee);
  }

  // ── Autenticación ──────────────────────────────────────────────────────
  async findByEmailWithPassword(email, session = null) {
    let query = this.model.findOne({ email, ...this._baseFilter() }).select('+passwordHash');
    if (session) query = query.session(session);
    return this.normalizeOutput(await query);
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

  // ── Scoping / dominio (operan sobre el tenant) ──────────────────────────
  findActiveResponsible(tenantId, employeeId, session = null) {
    let query = this.model.findOne({
      _id: employeeId,
      tenantId,
      status: EMPLOYEE_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id name');
    if (session) query = query.session(session);
    return this._applyTimeout(query.lean());
  }

  findActiveCourier(tenantId, courierId, session = null) {
    let query = this.model.findOne({
      _id: courierId,
      tenantId,
      role: EMPLOYEE_ROLE.COURIER,
      status: EMPLOYEE_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id name');
    if (session) query = query.session(session);
    return this._applyTimeout(query.lean());
  }

  /** Comprueba que el empleado siga activo y asociado a su empresa (login). */
  findActiveSelf(employeeId) {
    return this._applyTimeout(this.model.findOne({
      _id: employeeId,
      status: EMPLOYEE_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id tenantId role status').lean());
  }

  findOptions(filter) {
    return this._applyTimeout(this.model.find(filter)
      .select('_id name role')
      .sort({ name: 1 })
      .limit(500)
      .lean());
  }
}

module.exports = { EmployeesRepository };
