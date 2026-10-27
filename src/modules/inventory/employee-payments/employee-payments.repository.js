'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const EmployeePayment = require('./employee-payments.model');
const { applyMongoTimeout } = require('../../../config/mongo-query');

class EmployeePaymentsRepository extends MongoRepository {
  constructor() {
    super(EmployeePayment);
  }

  async listForCompany(filter, { page, limit }) {
    const [records, total] = await Promise.all([
      this._applyTimeout(this.model.find({ ...filter, recordStatus: RECORD_STATUS.ACTIVE })
        .sort({ paymentDate: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()),
      this._applyTimeout(this.model.countDocuments({ ...filter, recordStatus: RECORD_STATUS.ACTIVE })),
    ]);
    return { records, total };
  }

  summaryByEmployee(userId, from, toExclusive, employeeId = null) {
    const match = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    if (employeeId !== null) match.employeeId = employeeId;
    if (from || toExclusive) {
      match.paymentDate = {};
      if (from) match.paymentDate.$gte = from;
      if (toExclusive) match.paymentDate.$lt = toExclusive;
    }

    return applyMongoTimeout(this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$employeeId',
          employeeName: { $last: '$employeeSnapshot.name' },
          paymentCount: { $sum: 1 },
          totalPaid: { $sum: '$amount' },
        },
      },
      { $sort: { totalPaid: -1, employeeName: 1 } },
      { $project: { _id: 0, employeeId: '$_id', employeeName: 1, paymentCount: 1, totalPaid: 1 } },
    ]), this.queryTimeoutMs);
  }
}

module.exports = { EmployeePaymentsRepository };
