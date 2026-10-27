'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Employee = require('./employees.model');
const { EMPLOYEE_ROLE, EMPLOYEE_STATUS } = require('./employees.constants');
const { applyMongoTimeout } = require('../../../config/mongo-query');

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

  // ── Scoping / dominio (operan sobre el empresa) ──────────────────────────
  findActiveResponsible(userId, employeeId, session = null) {
    let query = this.model.findOne({
      _id: employeeId,
      userId,
      status: EMPLOYEE_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id name');
    if (session) query = query.session(session);
    return this._applyTimeout(query.lean());
  }

  findActiveCourier(userId, courierId, session = null) {
    let query = this.model.findOne({
      _id: courierId,
      userId,
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
    }).select('_id userId role status').lean());
  }

  findOptions(filter) {
    return this._applyTimeout(this.model.find(filter)
      .select('_id name role')
      .sort({ name: 1 })
      .limit(500)
      .lean());
  }

  listGlobal({ page = 1, limit = 20, search = null, role = null, status = null, recordStatus = null } = {}) {
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (recordStatus) filter.recordStatus = recordStatus;

    return this.filterAndPaginate(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      search: search
        ? { value: search, fields: ['name', 'email', 'phone', 'documentNumber'] }
        : null,
      includeDeleted: true,
    });
  }

  globalOverview() {
    const activeEmployee = {
      $and: [
        { $eq: ['$status', EMPLOYEE_STATUS.ACTIVE] },
        { $eq: ['$recordStatus', RECORD_STATUS.ACTIVE] },
      ],
    };
    const inactiveEmployee = {
      $and: [
        { $ne: ['$recordStatus', RECORD_STATUS.DELETED] },
        { $ne: ['$recordStatus', RECORD_STATUS.ARCHIVED] },
        {
          $or: [
            { $ne: ['$status', EMPLOYEE_STATUS.ACTIVE] },
            { $ne: ['$recordStatus', RECORD_STATUS.ACTIVE] },
          ],
        },
      ],
    };
    const archivedEmployee = { $eq: ['$recordStatus', RECORD_STATUS.ARCHIVED] };

    const pipeline = [{
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: { $cond: [{ $ne: ['$recordStatus', RECORD_STATUS.DELETED] }, 1, 0] } },
              active: { $sum: { $cond: [activeEmployee, 1, 0] } },
              inactive: { $sum: { $cond: [inactiveEmployee, 1, 0] } },
              archived: { $sum: { $cond: [archivedEmployee, 1, 0] } },
              deleted: { $sum: { $cond: [{ $eq: ['$recordStatus', RECORD_STATUS.DELETED] }, 1, 0] } },
            },
          },
          { $project: { _id: 0, total: 1, active: 1, inactive: 1, archived: 1, deleted: 1 } },
        ],
        byRole: [
          { $match: { recordStatus: { $ne: RECORD_STATUS.DELETED } } },
          {
            $group: {
              _id: '$role',
              total: { $sum: 1 },
              active: { $sum: { $cond: [activeEmployee, 1, 0] } },
              inactive: { $sum: { $cond: [inactiveEmployee, 1, 0] } },
              archived: { $sum: { $cond: [archivedEmployee, 1, 0] } },
            },
          },
          { $project: { _id: 0, role: '$_id', total: 1, active: 1, inactive: 1, archived: 1 } },
          { $sort: { total: -1, role: 1 } },
        ],
      },
    }];

    return applyMongoTimeout(this.model.aggregate(pipeline), this.queryTimeoutMs)
      .then(([result]) => ({
        ...(result?.totals?.[0] ?? { total: 0, active: 0, inactive: 0, archived: 0, deleted: 0 }),
        byRole: result?.byRole ?? [],
      }));
  }
}

module.exports = { EmployeesRepository };
