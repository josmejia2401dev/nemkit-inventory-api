'use strict';

const { BaseService, HttpError, UniqueNumberUtil, RECORD_STATUS } = require('nemkit');
const { CashWithdrawalsRepository } = require('./cash-withdrawals.repository');
const {
  CASH_WITHDRAWAL_REASONS,
  CASH_WITHDRAWAL_METHODS,
  CASH_WITHDRAWAL_REASON_LABELS,
} = require('./cash-withdrawals.constants');
const { pagination, businessDate, businessRange, positiveInteger } = require('../validation');

class CashWithdrawalsService extends BaseService {
  constructor() {
    super(new CashWithdrawalsRepository());
  }

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);
    const { from, toExclusive } = businessRange(query);
    const filter = { userId };
    if (from) filter.date = { $gte: from, $lt: toExclusive };
    if (query.reason) {
      if (!CASH_WITHDRAWAL_REASONS.includes(query.reason)) {
        throw HttpError.badRequest('Invalid withdrawal reason');
      }
      filter.reason = query.reason;
    }

    const result = await this.repository.listForCompany(filter, { page, limit });
    return {
      data: result.records.map(({ _id, ...withdrawal }) => ({ id: _id, ...withdrawal })),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async summary(userId, query = {}) {
    const { from, toExclusive } = businessRange(query);
    if (!from) throw HttpError.badRequest('from and to are required');

    const result = await this.repository.summary(userId, from, toExclusive);
    const count = result.totals.count;
    const total = this.roundMoney(result.totals.total);
    return {
      totals: {
        count,
        total,
        average: count > 0 ? this.roundMoney(total / count) : 0,
      },
      byReason: result.byReason.map((row) => ({
        reason: row.reason,
        label: CASH_WITHDRAWAL_REASON_LABELS[row.reason] ?? row.reason,
        count: row.count,
        total: this.roundMoney(row.total),
      })),
    };
  }

  async create(data, userId, actor = {}) {
    if (!CASH_WITHDRAWAL_REASONS.includes(data.reason)) {
      throw HttpError.badRequest('Invalid withdrawal reason');
    }
    if (data.method && !CASH_WITHDRAWAL_METHODS.includes(data.method)) {
      throw HttpError.badRequest('Invalid withdrawal method');
    }
    const amount = this.roundMoney(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw HttpError.badRequest('amount must be greater than zero');
    }

    const record = await this.repository.create({
      _id: UniqueNumberUtil.generateRaw(),
      userId,
      date: businessDate(data.date, 'date'),
      amount,
      reason: data.reason,
      beneficiary: data.beneficiary || actor.name || '',
      method: data.method || 'cash',
      reference: data.reference || '',
      notes: data.notes || '',
      recordedById: actor.id || userId,
      recordedBySnapshot: { name: actor.name || '' },
    }, actor.id || userId);

    return record;
  }

  async remove(id, userId) {
    const withdrawalId = positiveInteger(id, 'id');
    const active = await this.repository.findOne({
      _id: withdrawalId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });
    if (!active) throw HttpError.notFound('Cash withdrawal not found');

    const deleted = await this.repository.softDelete(withdrawalId, userId);
    if (!deleted) throw HttpError.notFound('Cash withdrawal not found');
    return deleted;
  }

  roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }
}

module.exports = { CashWithdrawalsService, cashWithdrawalsService: new CashWithdrawalsService() };
