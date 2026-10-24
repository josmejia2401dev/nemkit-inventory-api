'use strict';

const { RECORD_STATUS } = require('nemkit');
const { InventoryDocumentRepository } = require('../documents/document.repository');
const Sale = require('./sales.model');
const { DOCUMENT_STATUS, KITCHEN_STATUS, PAYMENT_STATUS } = require('../inventory.constants');
const { applyMongoTimeout } = require('../../../config/mongo-query');

const REPORT_TIMEZONE = 'America/Bogota';

class SalesRepository extends InventoryDocumentRepository {
  constructor() {
    super(Sale);
  }

  async listKitchenOrders(userId, includeServed) {
    const filter = {
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      kitchenStatus: { $ne: null },
      status: { $ne: DOCUMENT_STATUS.VOID },
    };
    if (!includeServed) {
      filter.kitchenStatus = {
        $in: [KITCHEN_STATUS.PENDING, KITCHEN_STATUS.PREPARING, KITCHEN_STATUS.READY],
      };
    }

    const sales = await this._applyTimeout(this.model.find(filter)
      .select('_id date tableNumber kitchenStatus orderStatus kitchenTimeline paymentStatus paidAt items total customerSnapshot employeeSnapshot notes')
      .sort({ date: 1 })
      .limit(200)
      .lean());
    return sales.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
  }

  findKitchenSale(id, userId) {
    return this.findOne({ _id: id, userId, recordStatus: RECORD_STATUS.ACTIVE });
  }

  async setKitchenState(id, userId, currentStatus, kitchenStatus, timeline, session) {
    const update = { kitchenStatus, orderStatus: kitchenStatus, updatedBy: userId };
    for (const [field, value] of Object.entries(timeline)) {
      update[`kitchenTimeline.${field}`] = value;
    }
    const result = await this._applyTimeout(this.model.updateOne(
      {
        _id: id,
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
        kitchenStatus: currentStatus,
      },
      { $set: update },
      { session },
    ));
    return result.matchedCount > 0;
  }

  setOrderStatusInSession(id, userId, orderStatus, session) {
    return this._applyTimeout(this.model.updateOne(
      { _id: id, userId, recordStatus: RECORD_STATUS.ACTIVE },
      { $set: { orderStatus, updatedBy: userId } },
      { session },
    ));
  }

  hasCustomerSales(userId, customerId) {
    return this._applyTimeout(this.model.exists({ userId, customerId }));
  }

  async listCustomerHistory(filter, { page, limit }) {
    const [sales, total] = await Promise.all([
      this._applyTimeout(this.model.find(filter)
        .select('_id date total items employeeSnapshot paymentStatus orderStatus kitchenStatus tableNumber')
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()),
      this._applyTimeout(this.model.countDocuments(filter)),
    ]);

    return { sales, total };
  }

  async customerAnalytics(userId, customerId) {
    const [result] = await applyMongoTimeout(this.model.aggregate([
      {
        $match: {
          userId,
          customerId,
          recordStatus: RECORD_STATUS.ACTIVE,
          status: { $ne: DOCUMENT_STATUS.VOID },
        },
      },
      { $sort: { date: 1, _id: 1 } },
      {
        $lookup: {
          from: 'inventory_deliveries',
          let: { saleId: '$_id', tenantId: '$userId' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$saleId', '$$saleId'] },
              { $eq: ['$userId', '$$tenantId'] },
            ] } } },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: 'deliveryLink',
        },
      },
      {
        $addFields: {
          isDelivery: {
            $or: [
              { $eq: ['$orderChannel', 'delivery'] },
              { $gt: [{ $size: '$deliveryLink' }, 0] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          paidOrders: { $sum: { $cond: [{ $eq: ['$paymentStatus', PAYMENT_STATUS.PAID] }, 1, 0] } },
          deliveryOrders: { $sum: { $cond: ['$isDelivery', 1, 0] } },
          onSiteOrders: { $sum: { $cond: ['$isDelivery', 0, 1] } },
          totalSpent: { $sum: { $cond: [{ $eq: ['$paymentStatus', PAYMENT_STATUS.PAID] }, '$total', 0] } },
          firstOrderAt: { $min: '$date' },
          lastOrderAt: { $max: '$date' },
          purchaseDates: { $push: { $cond: [{ $eq: ['$paymentStatus', PAYMENT_STATUS.PAID] }, '$date', null] } },
        },
      },
      {
        $project: {
          _id: 0,
          totalOrders: 1,
          paidOrders: 1,
          deliveryOrders: 1,
          onSiteOrders: 1,
          totalSpent: 1,
          firstOrderAt: 1,
          lastOrderAt: 1,
          averageOrderValue: {
            $cond: [{ $gt: ['$paidOrders', 0] }, { $divide: ['$totalSpent', '$paidOrders'] }, 0],
          },
          averageDaysBetweenPurchases: {
            $let: {
              vars: {
                dates: { $filter: { input: '$purchaseDates', as: 'date', cond: { $ne: ['$$date', null] } } },
              },
              in: {
                $cond: [
                  { $gt: [{ $size: '$$dates' }, 1] },
                  {
                    $let: {
                      vars: {
                        gaps: {
                          $reduce: {
                            input: '$$dates',
                            initialValue: { previous: null, totalMilliseconds: 0 },
                            in: {
                              previous: '$$this',
                              totalMilliseconds: {
                                $add: [
                                  '$$value.totalMilliseconds',
                                  { $cond: [{ $ne: ['$$value.previous', null] }, { $subtract: ['$$this', '$$value.previous'] }, 0] },
                                ],
                              },
                            },
                          },
                        },
                      },
                      in: {
                        $divide: [
                          { $divide: ['$$gaps.totalMilliseconds', 86400000] },
                          { $subtract: [{ $size: '$$dates' }, 1] },
                        ],
                      },
                    },
                  },
                  null,
                ],
              },
            },
          },
        },
      },
    ]), this.queryTimeoutMs);

    return result || {
      totalOrders: 0,
      paidOrders: 0,
      deliveryOrders: 0,
      onSiteOrders: 0,
      totalSpent: 0,
      averageOrderValue: 0,
      averageDaysBetweenPurchases: null,
      firstOrderAt: null,
      lastOrderAt: null,
    };
  }

  async activeKitchenOrderCountsByTable(userId) {
    return applyMongoTimeout(this.model.aggregate([
      {
        $match: {
          userId,
          recordStatus: RECORD_STATUS.ACTIVE,
          kitchenStatus: { $in: [KITCHEN_STATUS.PENDING, KITCHEN_STATUS.PREPARING, KITCHEN_STATUS.READY] },
          tableNumber: { $gt: '' },
        },
      },
      { $group: { _id: '$tableNumber', orders: { $sum: 1 } } },
    ]), this.queryTimeoutMs);
  }

  dashboardEmployeeSales(userId, since) {
    return applyMongoTimeout(this.model.aggregate([
      {
        $match: {
          userId,
          recordStatus: RECORD_STATUS.ACTIVE,
          status: { $ne: DOCUMENT_STATUS.VOID },
          paymentStatus: PAYMENT_STATUS.PAID,
          date: { $gte: since },
          employeeId: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$employeeId',
          employeeName: { $last: '$employeeSnapshot.name' },
          salesCount: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, employeeId: '$_id', employeeName: 1, salesCount: 1, revenue: 1 } },
    ]), this.queryTimeoutMs);
  }

  reportSales(match, groupBy) {
    return applyMongoTimeout(this.model.aggregate([
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
            { $project: { _id: 0, periodStart: '$_id', salesCount: 1, unitsSold: 1, revenue: 1, grossProfit: 1 } },
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
    ]), this.queryTimeoutMs);
  }

  reportSalesByEmployee(match) {
    return applyMongoTimeout(this.model.aggregate([
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
      { $project: { _id: 0, employeeId: '$_id', employeeName: 1, salesCount: 1, unitsSold: 1, revenue: 1, grossProfit: 1 } },
    ]), this.queryTimeoutMs);
  }
}

module.exports = { SalesRepository };
