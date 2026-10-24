'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Employee = require('./employees.model');
const { EMPLOYEE_ROLE, EMPLOYEE_STATUS } = require('../inventory.constants');

class EmployeesRepository extends MongoRepository {
  constructor() {
    super(Employee);
  }

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

  findActiveAssociationForUser(userId, employeeId) {
    return this._applyTimeout(this.model.findOne({
      _id: employeeId,
      linkedUserId: userId,
      status: EMPLOYEE_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    })
      .select('userId')
      .lean());
  }

  findOptions(filter) {
    return this._applyTimeout(this.model.find(filter)
      .select('_id name role')
      .sort({ name: 1 })
      .limit(500)
      .lean());
  }

  async createInSession(data, session) {
    const [employee] = await this.model.create([data], { session });
    return employee;
  }

  findInSession(filter, session) {
    return this._applyTimeout(this.model.findOne(filter).session(session).lean());
  }

  async listAccountHistory(userId) {
    return this._applyTimeout(this.model.find({
      $or: [{ linkedUserId: userId }, { formerUserId: userId }],
      ...this._baseFilter({ includeDeleted: true }),
    })
      .select('_id userId linkedUserId formerUserId name role status recordStatus createdAt createdBy disassociatedAt disassociatedBy')
      .sort({ createdAt: 1 })
      .lean());
  }

  async endAssociation(employeeId, tenantId, linkedUserId, actorId, session) {
    const filter = {
      _id: employeeId,
      userId: tenantId,
      recordStatus: RECORD_STATUS.ACTIVE,
    };
    filter.linkedUserId = linkedUserId ?? null;

    const doc = await this.model.findOneAndUpdate(
      filter,
      {
        $set: {
          formerUserId: linkedUserId,
          linkedUserId: null,
          disassociatedAt: new Date(),
          disassociatedBy: actorId,
          status: EMPLOYEE_STATUS.INACTIVE,
          recordStatus: RECORD_STATUS.INACTIVE,
          updatedBy: actorId,
        },
      },
      { returnDocument: 'after', session },
    );
    return this.normalizeOutput(doc);
  }
}

module.exports = { EmployeesRepository };
