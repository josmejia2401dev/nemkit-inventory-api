'use strict';

const { BaseService, HttpError, UniqueNumberUtil } = require('nemkit');
const { EmployeePaymentsRepository } = require('./employee-payments.repository');
const { employeesService } = require('../../foundation/employees/employees.service');
const { EMPLOYEE_PAYMENT_TYPES, EMPLOYEE_PAYMENT_METHODS } = require('./employee-payments.constants');
const { positiveInteger } = require('../validation');

function pagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit };
}

function range(query = {}) {
  const date = (value, field) => {
    if (!value) return null;
    const parsed = new Date(`${value}T05:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw HttpError.badRequest(`${field} must be a valid YYYY-MM-DD date`);
    }
    return parsed;
  };
  const from = date(query.from, 'from');
  const to = date(query.to, 'to');
  if ((from && !to) || (!from && to)) throw HttpError.badRequest('from and to must be provided together');
  if (from && to && from > to) throw HttpError.badRequest('from must be before or equal to to');
  return { from, toExclusive: to ? new Date(to.getTime() + 86400000) : null };
}

function businessDate(value, field) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw HttpError.badRequest(`${field} must be a valid date`);
  const calendarDate = parsed.toISOString().slice(0, 10);
  return new Date(`${calendarDate}T05:00:00.000Z`);
}

class EmployeePaymentsService extends BaseService {
  constructor() {
    super(new EmployeePaymentsRepository());
  }

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);
    const { from, toExclusive } = range(query);
    const filter = { userId };
    if (query.employeeId !== undefined) filter.employeeId = positiveInteger(query.employeeId, 'employeeId');
    if (from) filter.paymentDate = { $gte: from, $lt: toExclusive };

    const result = await this.repository.listForCompany(filter, { page, limit });
    return {
      data: result.records.map(({ _id, ...payment }) => ({ id: _id, ...payment })),
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    };
  }

  async summary(userId, query = {}) {
    const { from, toExclusive } = range(query);
    const employeeId = query.employeeId === undefined
      ? null
      : positiveInteger(query.employeeId, 'employeeId');
    const employees = await this.repository.summaryByEmployee(userId, from, toExclusive, employeeId);
    const rows = employees.map((row) => ({
      ...row,
      totalPaid: this.roundMoney(row.totalPaid),
    }));
    return {
      generatedAt: new Date(),
      totals: {
        employeeCount: rows.length,
        paymentCount: rows.reduce((sum, row) => sum + row.paymentCount, 0),
        totalPaid: this.roundMoney(rows.reduce((sum, row) => sum + row.totalPaid, 0)),
      },
      employees: rows,
    };
  }

  async create(data, userId, actor = {}) {
    if (!EMPLOYEE_PAYMENT_TYPES.includes(data.type)) throw HttpError.badRequest('Invalid payment type');
    if (data.method && !EMPLOYEE_PAYMENT_METHODS.includes(data.method)) throw HttpError.badRequest('Invalid payment method');
    if (!Number.isFinite(data.amount) || data.amount <= 0) throw HttpError.badRequest('amount must be greater than zero');

    const paymentDate = businessDate(data.paymentDate, 'paymentDate');
    const periodStart = data.periodStart ? businessDate(data.periodStart, 'periodStart') : null;
    const periodEnd = data.periodEnd ? businessDate(data.periodEnd, 'periodEnd') : null;
    if (periodStart && periodEnd && periodStart > periodEnd) {
      throw HttpError.badRequest('periodStart must be before or equal to periodEnd');
    }
    if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) {
      throw HttpError.badRequest('periodStart and periodEnd must be provided together');
    }

    const { employeeId, employeeSnapshot } = await employeesService.getPaymentSnapshot(data.employeeId, userId);
    const amount = this.roundMoney(data.amount);
    if (amount <= 0) throw HttpError.badRequest('amount must be greater than zero');
    const record = await this.repository.create({
      _id: UniqueNumberUtil.generateRaw(),
      userId,
      employeeId,
      employeeSnapshot,
      paymentDate,
      periodStart,
      periodEnd,
      type: data.type,
      amount,
      method: data.method || 'other',
      reference: data.reference || '',
      notes: data.notes || '',
      recordedById: actor.id || userId,
      recordedBySnapshot: { name: actor.name || '' },
    }, actor.id || userId);
    return record;
  }

  roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }
}

module.exports = { EmployeePaymentsService, employeePaymentsService: new EmployeePaymentsService() };
