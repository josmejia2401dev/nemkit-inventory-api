'use strict';

const { HttpError } = require('nemkit');
const { MOVEMENT_TYPES } = require('../inventory.constants');
const { positiveInteger } = require('../validation');
const { productsService } = require('../products/products.service');
const { movementsService } = require('../movements/movements.service');
const { salesService } = require('../sales/sales.service');
const { employeePaymentsService } = require('../employee-payments/employee-payments.service');

const MAX_RANGE_DAYS = 366;

function dateRange(query) {
  const { from, to } = query;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof from !== 'string' || !datePattern.test(from)
    || typeof to !== 'string' || !datePattern.test(to)) {
    throw HttpError.badRequest('from and to must use YYYY-MM-DD format');
  }

  const fromDate = new Date(`${from}T05:00:00.000Z`);
  const toDate = new Date(`${to}T05:00:00.000Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())
    || fromDate.toISOString().slice(0, 10) !== from
    || toDate.toISOString().slice(0, 10) !== to) {
    throw HttpError.badRequest('from and to must be valid calendar dates');
  }
  if (fromDate > toDate) throw HttpError.badRequest('from must be before or equal to to');

  const toExclusive = new Date(toDate.getTime() + 86400000);
  if ((toExclusive - fromDate) / 86400000 > MAX_RANGE_DAYS) {
    throw HttpError.badRequest(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }

  return { from: fromDate, toExclusive };
}

function pageOptions(query) {
  const page = query.page === undefined ? 1 : positiveInteger(query.page, 'page');
  const limit = query.limit === undefined ? 100 : positiveInteger(query.limit, 'limit');
  return { page, limit: Math.min(limit, 500) };
}

class ReportsService {
  inventory(userId) {
    return productsService.inventoryReport(userId);
  }

  async movements(userId, query = {}) {
    const range = dateRange(query);
    const { page, limit } = pageOptions(query);
    let type;
    let productId;

    if (query.type !== undefined) {
      if (!MOVEMENT_TYPES.includes(query.type)) {
        throw HttpError.badRequest(`type must be one of: ${MOVEMENT_TYPES.join(', ')}`);
      }
      type = query.type;
    }
    if (query.productId !== undefined) {
      productId = positiveInteger(query.productId, 'productId');
    }

    const result = await movementsService.report(userId, {
      ...range,
      type,
      productId,
      page,
      limit,
    });

    return { ...result, range };
  }

  async sales(userId, query = {}) {
    const range = dateRange(query);
    const groupBy = query.groupBy ?? 'day';
    if (!['day', 'week', 'month'].includes(groupBy)) {
      throw HttpError.badRequest('groupBy must be day, week or month');
    }

    const employeeId = query.employeeId === undefined
      ? null
      : positiveInteger(query.employeeId, 'employeeId');

    return salesService.reportSales(userId, range, groupBy, employeeId);
  }

  async salesByEmployee(userId, query = {}) {
    const range = dateRange(query);
    const [sales, payments] = await Promise.all([
      salesService.reportSalesByEmployee(userId, range),
      employeePaymentsService.summary(userId, query),
    ]);
    const paymentByEmployee = new Map(payments.employees.map((row) => [row.employeeId, row]));
    const salesEmployees = sales.employees.map((row) => ({
      ...row,
      paymentsMade: paymentByEmployee.get(row.employeeId)?.totalPaid ?? 0,
      paymentCount: paymentByEmployee.get(row.employeeId)?.paymentCount ?? 0,
    }));
    const salesEmployeeIds = new Set(salesEmployees.map((row) => row.employeeId));
    const paymentOnlyEmployees = payments.employees
      .filter((row) => !salesEmployeeIds.has(row.employeeId))
      .map((row) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        salesCount: 0,
        unitsSold: 0,
        revenue: 0,
        collectedValue: 0,
        pendingValue: 0,
        collectedInPeriod: 0,
        collectionsCount: 0,
        grossProfit: 0,
        paymentsMade: row.totalPaid,
        paymentCount: row.paymentCount,
      }));
    const employees = [...salesEmployees, ...paymentOnlyEmployees]
      .sort((a, b) => (b.revenue - a.revenue) || (b.paymentsMade - a.paymentsMade));

    return {
      ...sales,
      employees,
      totals: {
        ...sales.totals,
        employeeCount: new Set(employees.map((row) => row.employeeId).filter((id) => id != null)).size,
        paymentsMade: payments.totals.totalPaid,
        paymentCount: payments.totals.paymentCount,
      },
      payments,
    };
  }

  async cancelledSales(userId, query = {}) {
    const range = dateRange(query);
    const { page, limit } = pageOptions(query);
    return salesService.reportCancelledSales(userId, range, { page, limit });
  }
}

module.exports = { ReportsService, reportsService: new ReportsService() };
