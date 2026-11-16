'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const { applyMongoTimeout } = require('../../../config/mongo-query');
const CashWithdrawal = require('./cash-withdrawals.model');

class CashWithdrawalsRepository extends MongoRepository {
  constructor() {
    super(CashWithdrawal);
  }

  async listForCompany(filter, { page, limit }) {
    const active = { ...filter, recordStatus: RECORD_STATUS.ACTIVE };
    const [records, total] = await Promise.all([
      this._applyTimeout(this.model.find(active)
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()),
      this._applyTimeout(this.model.countDocuments(active)),
    ]);
    return { records, total };
  }

  /** Totales del rango y desglose por motivo en una sola pasada. */
  async summary(userId, from, toExclusive) {
    const match = {
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      date: { $gte: from, $lt: toExclusive },
    };
    const [result] = await applyMongoTimeout(this.model.aggregate([
      { $match: match },
      { $facet: {
        totals: [
          { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
          { $project: { _id: 0, count: 1, total: 1 } },
        ],
        byReason: [
          { $group: { _id: '$reason', count: { $sum: 1 }, total: { $sum: '$amount' } } },
          { $sort: { total: -1 } },
          { $project: { _id: 0, reason: '$_id', count: 1, total: 1 } },
        ],
      } },
    ]), this.queryTimeoutMs);
    return {
      totals: result?.totals?.[0] ?? { count: 0, total: 0 },
      byReason: result?.byReason ?? [],
    };
  }

  /** Baja lógica con auditoría; nunca se borra el documento. */
  async softDelete(id, userId) {
    const doc = await this._applyTimeout(this.model.findOneAndUpdate(
      { _id: id, userId, recordStatus: RECORD_STATUS.ACTIVE },
      { $set: { recordStatus: RECORD_STATUS.DELETED, updatedBy: userId } },
      { returnDocument: 'after' },
    ));
    return this.normalizeOutput(doc);
  }
}

module.exports = { CashWithdrawalsRepository };
