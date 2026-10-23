'use strict';

const { HttpError, RECORD_STATUS } = require('nemkit');
const Product = require('../products/products.model');
const Category = require('../categories/categories.model');
const Movement = require('../movements/movements.model');
const Sale = require('../sales/sales.model');
const { MOVEMENT_TYPES } = require('../inventory.constants');
const { positiveInteger } = require('../validation');

const REPORT_TIMEZONE = 'America/Bogota';
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
  async inventory(userId) {
    const products = await Product.find({ userId, recordStatus: RECORD_STATUS.ACTIVE })
      .select('_id sku name categoryId purchasePrice salePrice stock minimumStock status')
      .sort({ name: 1 })
      .lean();
    const categoryIds = [...new Set(products.map((product) => product.categoryId))];
    const categories = await Category.find({
      userId,
      _id: { $in: categoryIds },
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id name').lean();
    const categoryNames = new Map(categories.map((category) => [category._id, category.name]));

    const items = products.map((product) => ({
      id: product._id,
      sku: product.sku,
      name: product.name,
      categoryName: categoryNames.get(product.categoryId) || 'Sin categoría',
      status: product.status,
      stock: product.stock,
      minimumStock: product.minimumStock,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      inventoryCost: this.#roundMoney(product.stock * product.purchasePrice),
      potentialSales: this.#roundMoney(product.stock * product.salePrice),
    }));

    return {
      generatedAt: new Date(),
      totals: {
        productCount: items.length,
        units: items.reduce((sum, item) => sum + item.stock, 0),
        inventoryCost: this.#roundMoney(items.reduce((sum, item) => sum + item.inventoryCost, 0)),
        potentialSales: this.#roundMoney(items.reduce((sum, item) => sum + item.potentialSales, 0)),
      },
      items,
    };
  }

  async movements(userId, query = {}) {
    const range = dateRange(query);
    const { page, limit } = pageOptions(query);
    const filter = {
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      date: { $gte: range.from, $lt: range.toExclusive },
    };

    if (query.type !== undefined) {
      if (!MOVEMENT_TYPES.includes(query.type)) {
        throw HttpError.badRequest(`type must be one of: ${MOVEMENT_TYPES.join(', ')}`);
      }
      filter.type = query.type;
    }
    if (query.productId !== undefined) {
      filter['items.productId'] = positiveInteger(query.productId, 'productId');
    }

    const [documents, total] = await Promise.all([
      Movement.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Movement.countDocuments(filter),
    ]);
    const productIds = [...new Set(documents.flatMap((movement) => movement.items.map((item) => item.productId)))];
    const products = await Product.find({ userId, _id: { $in: productIds } })
      .select('_id name sku')
      .lean();
    const productById = new Map(products.map((product) => [product._id, product]));

    return {
      data: documents.map(({ _id, userId: _userId, ...movement }) => ({
        id: _id,
        ...movement,
        items: movement.items.map((item) => ({
          ...item,
          name: productById.get(item.productId)?.name || `Producto #${item.productId}`,
          sku: productById.get(item.productId)?.sku || '',
        })),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      range,
    };
  }

  async sales(userId, query = {}) {
    const range = dateRange(query);
    const groupBy = query.groupBy ?? 'day';
    if (!['day', 'week', 'month'].includes(groupBy)) {
      throw HttpError.badRequest('groupBy must be day, week or month');
    }

    const match = {
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      date: { $gte: range.from, $lt: range.toExclusive },
    };
    if (query.employeeId !== undefined) {
      match.employeeId = positiveInteger(query.employeeId, 'employeeId');
    }

    const result = await Sale.aggregate([
      { $match: match },
      {
        $addFields: {
          unitsSold: { $sum: '$items.quantity' },
          grossProfit: {
            $reduce: {
              input: '$items',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  { $multiply: [{ $subtract: ['$$this.unitPrice', '$$this.unitCost'] }, '$$this.quantity'] },
                ],
              },
            },
          },
          period: {
            $dateTrunc: {
              date: '$date',
              unit: groupBy,
              ...(groupBy === 'week' ? { startOfWeek: 'monday' } : {}),
              timezone: REPORT_TIMEZONE,
            },
          },
        },
      },
      {
        $facet: {
          periods: [
            {
              $group: {
                _id: '$period',
                salesCount: { $sum: 1 },
                unitsSold: { $sum: '$unitsSold' },
                revenue: { $sum: '$total' },
                grossProfit: { $sum: '$grossProfit' },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                periodStart: '$_id',
                salesCount: 1,
                unitsSold: 1,
                revenue: 1,
                grossProfit: 1,
              },
            },
          ],
          totals: [
            {
              $group: {
                _id: null,
                salesCount: { $sum: 1 },
                unitsSold: { $sum: '$unitsSold' },
                revenue: { $sum: '$total' },
                grossProfit: { $sum: '$grossProfit' },
              },
            },
            { $project: { _id: 0 } },
          ],
        },
      },
    ]);

    return {
      groupBy,
      employeeId: match.employeeId ?? null,
      totals: result[0]?.totals[0] || { salesCount: 0, unitsSold: 0, revenue: 0, grossProfit: 0 },
      periods: result[0]?.periods || [],
    };
  }

  /**
   * Ventas agregadas por empleado vendedor en un rango de fechas.
   * Conserva el nombre vía snapshot aunque el empleado se haya editado o eliminado.
   */
  async salesByEmployee(userId, query = {}) {
    const range = dateRange(query);

    const result = await Sale.aggregate([
      {
        $match: {
          userId,
          recordStatus: RECORD_STATUS.ACTIVE,
          date: { $gte: range.from, $lt: range.toExclusive },
        },
      },
      {
        $addFields: {
          unitsSold: { $sum: '$items.quantity' },
          grossProfit: {
            $reduce: {
              input: '$items',
              initialValue: 0,
              in: {
                $add: [
                  '$$value',
                  { $multiply: [{ $subtract: ['$$this.unitPrice', '$$this.unitCost'] }, '$$this.quantity'] },
                ],
              },
            },
          },
        },
      },
      {
        $group: {
          _id: '$employeeId',
          employeeName: { $last: '$employeeSnapshot.name' },
          salesCount: { $sum: 1 },
          unitsSold: { $sum: '$unitsSold' },
          revenue: { $sum: '$total' },
          grossProfit: { $sum: '$grossProfit' },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $project: {
          _id: 0,
          employeeId: '$_id',
          employeeName: 1,
          salesCount: 1,
          unitsSold: 1,
          revenue: 1,
          grossProfit: 1,
        },
      },
    ]);

    const employees = result.map((row) => ({
      employeeId: row.employeeId ?? null,
      employeeName: row.employeeName || (row.employeeId ? `Empleado #${row.employeeId}` : 'Sin asignar'),
      salesCount: row.salesCount,
      unitsSold: row.unitsSold,
      revenue: this.#roundMoney(row.revenue),
      grossProfit: this.#roundMoney(row.grossProfit),
    }));

    return {
      generatedAt: new Date(),
      totals: {
        employeeCount: employees.filter((employee) => employee.employeeId != null).length,
        salesCount: employees.reduce((sum, employee) => sum + employee.salesCount, 0),
        unitsSold: employees.reduce((sum, employee) => sum + employee.unitsSold, 0),
        revenue: this.#roundMoney(employees.reduce((sum, employee) => sum + employee.revenue, 0)),
        grossProfit: this.#roundMoney(employees.reduce((sum, employee) => sum + employee.grossProfit, 0)),
      },
      employees,
    };
  }

  #roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

module.exports = { ReportsService, reportsService: new ReportsService() };
