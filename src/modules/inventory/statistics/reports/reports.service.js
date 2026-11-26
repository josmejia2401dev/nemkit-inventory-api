'use strict';

const { HttpError, RECORD_STATUS } = require('nemkit');
const models = require('../statistics.models');
const { MOVEMENT_TYPES } = require('../../inventory.constants');
const { CASH_WITHDRAWAL_REASON_LABELS } = require('../../cash-withdrawals/cash-withdrawals.constants');
const { positiveInteger } = require('../../validation');
const { dateRange, pageOptions, roundMoney, sum } = require('../shared/aggregations');
const { inventoryReport: buildInventoryReport } = require('./inventory.report');
const { movementsReport: buildMovementsReport } = require('./movements.report');
const { salesReport: buildSalesReport } = require('./sales.report');
const { salesByEmployee: buildSalesByEmployee, employeePaymentSummary: buildEmployeePaymentSummary } = require('./employees.report');
const { cancelledSales: buildCancelledSales } = require('./cancellations.report');
const { cashFlow: buildCashFlow } = require('./cash-flow.report');

class ReportsService {
  constructor(reportModels = models) {
    this.models = reportModels;
  }

  inventoryReport(userId) {
    return buildInventoryReport(this.models, userId);
  }

  async movementsReport(userId, query = {}) {
    const range = dateRange(query);
    const { page, limit } = pageOptions(query);
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

    const result = await buildMovementsReport(this.models, userId, filter, { page, limit });
    return { ...result, range };
  }

  async salesReport(userId, query = {}) {
    const range = dateRange(query);
    const groupBy = query.groupBy ?? 'day';
    if (!['day', 'week', 'month'].includes(groupBy)) {
      throw HttpError.badRequest('groupBy must be day, week or month');
    }
    const employeeId = query.employeeId === undefined ? null : positiveInteger(query.employeeId, 'employeeId');
    const [result] = await buildSalesReport(this.models, userId, range.from, range.toExclusive, groupBy, employeeId);
    return {
      groupBy,
      employeeId,
      totals: result?.totals?.[0] || { salesCount: 0, unitsSold: 0, revenue: 0, grossProfit: 0 },
      periods: result?.periods || [],
    };
  }

  async salesByEmployee(userId, query = {}) {
    const range = dateRange(query);
    const [salesRows = [], collectionRows = [], cancellationRows = [], paymentRows = []] = await buildSalesByEmployee(
      this.models,
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
        revenue: roundMoney(row.revenue),
        collectedValue: roundMoney(row.collectedValue),
        pendingValue: roundMoney(row.pendingValue),
        grossProfit: roundMoney(row.grossProfit),
      });
    }
    for (const row of collectionRows) {
      Object.assign(employeeFor(row), {
        collectedInPeriod: roundMoney(row.collectedInPeriod),
        collectionsCount: row.collectionsCount,
      });
    }
    for (const row of cancellationRows) {
      Object.assign(employeeFor(row), {
        cancellationCount: row.cancellationCount,
        cancelledValue: roundMoney(row.cancelledValue),
      });
    }
    for (const row of paymentRows) {
      Object.assign(employeeFor(row), {
        paymentsMade: roundMoney(row.totalPaid),
        paymentCount: row.paymentCount,
      });
    }

    const employees = [...byEmployee.values()].sort((a, b) => (b.revenue - a.revenue) || (b.paymentsMade - a.paymentsMade));
    return {
      generatedAt: new Date(),
      totals: {
        employeeCount: employees.filter((employee) => employee.employeeId != null).length,
        salesCount: employees.reduce((total, row) => total + row.salesCount, 0),
        unitsSold: employees.reduce((total, row) => total + row.unitsSold, 0),
        revenue: sum(employees, 'revenue'),
        collectedValue: sum(employees, 'collectedValue'),
        pendingValue: sum(employees, 'pendingValue'),
        collectedInPeriod: sum(employees, 'collectedInPeriod'),
        collectionsCount: employees.reduce((total, row) => total + row.collectionsCount, 0),
        cancellationCount: employees.reduce((total, row) => total + row.cancellationCount, 0),
        cancelledValue: sum(employees, 'cancelledValue'),
        grossProfit: sum(employees, 'grossProfit'),
        paymentsMade: sum(employees, 'paymentsMade'),
        paymentCount: employees.reduce((total, row) => total + row.paymentCount, 0),
      },
      employees,
      payments: {
        generatedAt: new Date(),
        totals: {
          employeeCount: paymentRows.length,
          paymentCount: paymentRows.reduce((total, row) => total + row.paymentCount, 0),
          totalPaid: roundMoney(paymentRows.reduce((total, row) => total + row.totalPaid, 0)),
        },
        employees: paymentRows.map((row) => ({ ...row, totalPaid: roundMoney(row.totalPaid) })),
      },
    };
  }

  async employeePaymentsSummary(userId, query = {}) {
    const range = query.from || query.to
      ? dateRange(query, { enforceMax: false })
      : { from: null, toExclusive: null };
    if ((query.from && !query.to) || (!query.from && query.to)) {
      throw HttpError.badRequest('from and to must be provided together');
    }
    const employeeId = query.employeeId === undefined ? null : positiveInteger(query.employeeId, 'employeeId');
    const employees = await buildEmployeePaymentSummary(this.models, userId, range.from, range.toExclusive, employeeId);
    return {
      generatedAt: new Date(),
      totals: {
        employeeCount: employees.length,
        paymentCount: employees.reduce((total, row) => total + row.paymentCount, 0),
        totalPaid: roundMoney(employees.reduce((total, row) => total + row.totalPaid, 0)),
      },
      employees: employees.map((row) => ({ ...row, totalPaid: roundMoney(row.totalPaid) })),
    };
  }

  /**
   * Flujo de caja del periodo. Solo lectura: no altera ventas, utilidad ni
   * fidelización; los retiros se consultan desde su colección aislada.
   */
  async cashFlow(userId, query = {}) {
    const range = dateRange(query);
    const [
      sales = [],
      purchases = [],
      payments = [],
      withdrawals = [],
      layawayPayments = [],
      layawayRefunds = [],
    ] = await buildCashFlow(
      this.models,
      userId,
      range.from,
      range.toExclusive,
    );

    const salesTotal = roundMoney(sales[0]?.total ?? 0);
    const purchasesTotal = roundMoney(purchases[0]?.total ?? 0);
    const paymentsTotal = roundMoney(payments[0]?.total ?? 0);
    const withdrawalTotals = withdrawals[0]?.totals?.[0] ?? { count: 0, total: 0 };
    const withdrawalsTotal = roundMoney(withdrawalTotals.total);
    const layawayPaymentsTotal = roundMoney(layawayPayments[0]?.total ?? 0);
    const layawayRefundsTotal = roundMoney(layawayRefunds[0]?.total ?? 0);
    const outflowsTotal = roundMoney(
      purchasesTotal + paymentsTotal + withdrawalsTotal + layawayRefundsTotal,
    );
    const inflowsTotal = roundMoney(salesTotal + layawayPaymentsTotal);

    return {
      range: { from: query.from, to: query.to },
      inflows: {
        sales: salesTotal,
        salesCount: sales[0]?.count ?? 0,
        layawayPayments: layawayPaymentsTotal,
        layawayPaymentsCount: layawayPayments[0]?.count ?? 0,
        total: inflowsTotal,
      },
      outflows: {
        purchases: purchasesTotal,
        purchasesCount: purchases[0]?.count ?? 0,
        employeePayments: paymentsTotal,
        employeePaymentsCount: payments[0]?.count ?? 0,
        withdrawals: withdrawalsTotal,
        withdrawalsCount: withdrawalTotals.count,
        layawayRefunds: layawayRefundsTotal,
        layawayRefundsCount: layawayRefunds[0]?.count ?? 0,
        total: outflowsTotal,
      },
      net: roundMoney(inflowsTotal - outflowsTotal),
      withdrawalsByReason: (withdrawals[0]?.byReason ?? []).map((row) => ({
        reason: row.reason,
        label: CASH_WITHDRAWAL_REASON_LABELS[row.reason] ?? row.reason,
        count: row.count,
        total: roundMoney(row.total),
      })),
    };
  }

  async cancelledSales(userId, query = {}) {
    const range = dateRange(query);
    const { page, limit } = pageOptions(query);
    const [result] = await buildCancelledSales(this.models, userId, range.from, range.toExclusive, { page, limit });
    return {
      generatedAt: new Date(),
      totals: {
        cancellationCount: result?.totals?.[0]?.cancellationCount ?? 0,
        cancelledValue: roundMoney(result?.totals?.[0]?.cancelledValue ?? 0),
      },
      cancellations: (result?.cancellations ?? []).map(({ _id, ...sale }) => ({ id: _id, ...sale })),
      pagination: { page, limit, total: result?.count?.[0]?.total ?? 0, totalPages: Math.ceil((result?.count?.[0]?.total ?? 0) / limit) },
    };
  }
}

module.exports = { ReportsService, reportsService: new ReportsService() };
