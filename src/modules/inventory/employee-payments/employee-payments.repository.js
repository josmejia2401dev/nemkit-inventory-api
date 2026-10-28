'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const EmployeePayment = require('./employee-payments.model');

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

}

module.exports = { EmployeePaymentsRepository };
