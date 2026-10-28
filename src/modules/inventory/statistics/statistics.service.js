'use strict';

const { HttpError, RECORD_STATUS } = require('nemkit');
const { StatisticsRepository } = require('./statistics.repository');
const models = require('./statistics.models');
const { MOVEMENT_TYPES } = require('../inventory.constants');
const { LOYALTY_TIER_RULES, resolveLoyaltyTier } = require('./statistics.constants');
const { positiveInteger } = require('../validation');

const MAX_RANGE_DAYS = 366;

class StatisticsService {
  constructor(repository = new StatisticsRepository(models)) {
    this.repository = repository;
  }

  dashboardSummary(userId) {
    return this.repository.dashboard(userId, new Date(Date.now() - 30 * 86400000));
  }

  stockAlerts(userId) {
    return this.repository.stockAlerts(userId);
  }

  customerLoyaltyRules() {
    return LOYALTY_TIER_RULES;
  }

  async recordCustomerPurchase(customer, amount, date, userId, session = null) {
    const previousSpent = customer.stats?.totalSpent ?? 0;
    const previousCount = customer.stats?.purchaseCount ?? 0;
    const totalSpent = this.#roundMoney(previousSpent + amount);
    const purchaseCount = previousCount + 1;
    return this.repository.updateCustomerMetrics(userId, customer._id, {
      'stats.totalSpent': totalSpent,
      'stats.purchaseCount': purchaseCount,
      'stats.firstPurchaseAt': customer.stats?.firstPurchaseAt ?? date,
      'stats.lastPurchaseAt': date,
      loyaltyTier: resolveLoyaltyTier(totalSpent, purchaseCount),
    }, session);
  }

  async reverseCustomerPurchase(customerId, amount, userId, session = null) {
    const customer = await this.repository.findCustomerForMetrics(userId, customerId, session);
    if (!customer) return false;
    const totalSpent = Math.max(0, this.#roundMoney((customer.stats?.totalSpent ?? 0) - amount));
    const purchaseCount = Math.max(0, (customer.stats?.purchaseCount ?? 0) - 1);
    await this.repository.updateCustomerMetrics(userId, customer._id, {
      'stats.totalSpent': totalSpent,
      'stats.purchaseCount': purchaseCount,
      loyaltyTier: resolveLoyaltyTier(totalSpent, purchaseCount),
    }, session);
    return true;
  }

  async customerProfile(customerId, userId, query = {}) {
    const id = positiveInteger(customerId, 'customerId');
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const profile = await this.repository.customerProfile(userId, id, { page, limit });
    if (!profile.customer) throw HttpError.notFound('Customer not found');
    return { ...profile, loyaltyRules: LOYALTY_TIER_RULES };
  }

  inventoryReport(userId) {
    return this.repository.inventoryReport(userId);
  }

  async movementsReport(userId, query = {}) {
    const range = this.#dateRange(query);
    const { page, limit } = this.#pageOptions(query);
    const filter = {
      userId,
      recordStatus: { $ne: RECORD_STATUS.DELETED },
      date: { $gte: range.from, $lt: range.toExclusive },
    };
    if (query.type !== undefined) {
      if (!MOVEMENT_TYPES.includes(query.type)) {
        throw HttpError.badRequest(`type must be one of: ${MOVEMENT_TYPES.join(', ')}`);
      }
      filter.type = query.type;
    }
    if (query.productId !== undefined) filter['items.productId'] = positiveInteger(query.productId, 'productId');

    const result = await this.repository.movementsReport(userId, filter, { page, limit });
    return { ...result, range };
  }

  async salesReport(userId, query = {}) {
    const range = this.#dateRange(query);
    const groupBy = query.groupBy ?? 'day';
    if (!['day', 'week', 'month'].includes(groupBy)) {
      throw HttpError.badRequest('groupBy must be day, week or month');
    }
    const employeeId = query.employeeId === undefined ? null : positiveInteger(query.employeeId, 'employeeId');
    const [result] = await this.repository.reportSales(userId, range.from, range.toExclusive, groupBy, employeeId);
    return {
      groupBy,
      employeeId,
      totals: result?.totals?.[0] || { salesCount: 0, unitsSold: 0, revenue: 0, grossProfit: 0 },
      periods: result?.periods || [],
    };
  }

  async salesByEmployee(userId, query = {}) {
    const range = this.#dateRange(query);
    const [salesRows = [], collectionRows = [], cancellationRows = [], paymentRows = []] = await this.repository.reportSalesByEmployee(
      userId,
      range.from,
      range.toExclusive,
    );
    const byEmployee = new Map();
    const employeeFor = (row) => {
      const employeeId = row.employeeId ?? null;
      if (!byEmployee.has(employeeId)) {
        byEmployee.set(employeeId, {
          employeeId,
          employeeName: row.employeeName || (employeeId ? `Empleado #${employeeId}` : 'Sin asignar'),
          salesCount: 0,
          unitsSold: 0,
          revenue: 0,
          collectedValue: 0,
          pendingValue: 0,
          collectedInPeriod: 0,
          collectionsCount: 0,
          cancellationCount: 0,
          cancelledValue: 0,
          grossProfit: 0,
          paymentsMade: 0,
          paymentCount: 0,
        });
      }
      return byEmployee.get(employeeId);
    };

    for (const row of salesRows) {
      Object.assign(employeeFor(row), {
        salesCount: row.salesCount,
        unitsSold: row.unitsSold,
        revenue: this.#roundMoney(row.revenue),
        collectedValue: this.#roundMoney(row.collectedValue),
        pendingValue: this.#roundMoney(row.pendingValue),
        grossProfit: this.#roundMoney(row.grossProfit),
      });
    }
    for (const row of collectionRows) {
      Object.assign(employeeFor(row), {
        collectedInPeriod: this.#roundMoney(row.collectedInPeriod),
        collectionsCount: row.collectionsCount,
      });
    }
    for (const row of cancellationRows) {
      Object.assign(employeeFor(row), {
        cancellationCount: row.cancellationCount,
        cancelledValue: this.#roundMoney(row.cancelledValue),
      });
    }
    for (const row of paymentRows) {
      Object.assign(employeeFor(row), {
        paymentsMade: this.#roundMoney(row.totalPaid),
        paymentCount: row.paymentCount,
      });
    }

    const employees = [...byEmployee.values()].sort((a, b) => (b.revenue - a.revenue) || (b.paymentsMade - a.paymentsMade));
    return {
      generatedAt: new Date(),
      totals: {
        employeeCount: employees.filter((employee) => employee.employeeId != null).length,
        salesCount: employees.reduce((sum, row) => sum + row.salesCount, 0),
        unitsSold: employees.reduce((sum, row) => sum + row.unitsSold, 0),
        revenue: this.#sum(employees, 'revenue'),
        collectedValue: this.#sum(employees, 'collectedValue'),
        pendingValue: this.#sum(employees, 'pendingValue'),
        collectedInPeriod: this.#sum(employees, 'collectedInPeriod'),
        collectionsCount: employees.reduce((sum, row) => sum + row.collectionsCount, 0),
        cancellationCount: employees.reduce((sum, row) => sum + row.cancellationCount, 0),
        cancelledValue: this.#sum(employees, 'cancelledValue'),
        grossProfit: this.#sum(employees, 'grossProfit'),
        paymentsMade: this.#sum(employees, 'paymentsMade'),
        paymentCount: employees.reduce((sum, row) => sum + row.paymentCount, 0),
      },
      employees,
      payments: {
        generatedAt: new Date(),
        totals: {
          employeeCount: paymentRows.length,
          paymentCount: paymentRows.reduce((sum, row) => sum + row.paymentCount, 0),
          totalPaid: this.#roundMoney(paymentRows.reduce((sum, row) => sum + row.totalPaid, 0)),
        },
        employees: paymentRows.map((row) => ({ ...row, totalPaid: this.#roundMoney(row.totalPaid) })),
      },
    };
  }

  async employeePaymentsSummary(userId, query = {}) {
    const range = query.from || query.to
      ? this.#dateRange(query, { enforceMax: false })
      : { from: null, toExclusive: null };
    if ((query.from && !query.to) || (!query.from && query.to)) {
      throw HttpError.badRequest('from and to must be provided together');
    }
    const employeeId = query.employeeId === undefined ? null : positiveInteger(query.employeeId, 'employeeId');
    const employees = await this.repository.employeePaymentSummary(userId, range.from, range.toExclusive, employeeId);
    return {
      generatedAt: new Date(),
      totals: {
        employeeCount: employees.length,
        paymentCount: employees.reduce((sum, row) => sum + row.paymentCount, 0),
        totalPaid: this.#roundMoney(employees.reduce((sum, row) => sum + row.totalPaid, 0)),
      },
      employees: employees.map((row) => ({ ...row, totalPaid: this.#roundMoney(row.totalPaid) })),
    };
  }

  async cancelledSales(userId, query = {}) {
    const range = this.#dateRange(query);
    const { page, limit } = this.#pageOptions(query);
    const [result] = await this.repository.cancelledSales(userId, range.from, range.toExclusive, { page, limit });
    return {
      generatedAt: new Date(),
      totals: {
        cancellationCount: result?.totals?.[0]?.cancellationCount ?? 0,
        cancelledValue: this.#roundMoney(result?.totals?.[0]?.cancelledValue ?? 0),
      },
      cancellations: (result?.cancellations ?? []).map(({ _id, ...sale }) => ({ id: _id, ...sale })),
      pagination: { page, limit, total: result?.count?.[0]?.total ?? 0, totalPages: Math.ceil((result?.count?.[0]?.total ?? 0) / limit) },
    };
  }

  #dateRange(query, { enforceMax = true } = {}) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const { from, to } = query;
    if (typeof from !== 'string' || !datePattern.test(from) || typeof to !== 'string' || !datePattern.test(to)) {
      throw HttpError.badRequest('from and to must use YYYY-MM-DD format');
    }
    const fromDate = new Date(`${from}T05:00:00.000Z`);
    const toDate = new Date(`${to}T05:00:00.000Z`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())
      || fromDate.toISOString().slice(0, 10) !== from || toDate.toISOString().slice(0, 10) !== to) {
      throw HttpError.badRequest('from and to must be valid calendar dates');
    }
    if (fromDate > toDate) throw HttpError.badRequest('from must be before or equal to to');
    const toExclusive = new Date(toDate.getTime() + 86400000);
    if (enforceMax && (toExclusive - fromDate) / 86400000 > MAX_RANGE_DAYS) {
      throw HttpError.badRequest(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
    }
    return { from: fromDate, toExclusive };
  }

  #pageOptions(query) {
    const page = query.page === undefined ? 1 : positiveInteger(query.page, 'page');
    const requestedLimit = query.limit === undefined ? 100 : positiveInteger(query.limit, 'limit');
    return { page, limit: Math.min(requestedLimit, 500) };
  }

  #sum(rows, field) {
    return this.#roundMoney(rows.reduce((sum, row) => sum + row[field], 0));
  }

  #roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

module.exports = { StatisticsService, statisticsService: new StatisticsService() };
