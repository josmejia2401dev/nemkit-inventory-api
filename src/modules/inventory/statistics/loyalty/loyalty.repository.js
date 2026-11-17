'use strict';

const { RECORD_STATUS } = require('nemkit');
const { withTimeout } = require('../shared/db');
const { DOCUMENT_STATUS, PAYMENT_STATUS } = require('../../inventory.constants');

class LoyaltyRepository {
  constructor(models) {
    this.models = models;
  }

  async customerProfile(userId, customerId, { page, limit }) {
    const { Customer, Sale } = this.models;
    const [customer, [sales, total], analyticsRows, cancelledOrders] = await Promise.all([
      withTimeout(Customer.findOne({ _id: customerId, userId, recordStatus: RECORD_STATUS.ACTIVE }).lean()),
      Promise.all([
        withTimeout(Sale.find({ userId, customerId, recordStatus: RECORD_STATUS.ACTIVE })
          .select('_id date total items employeeSnapshot paymentStatus orderStatus kitchenStatus tableNumber status voidReason voidNote voidedAt')
          .sort({ date: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()),
        withTimeout(Sale.countDocuments({ userId, customerId, recordStatus: RECORD_STATUS.ACTIVE })),
      ]),
      withTimeout(Sale.aggregate([
        { $match: { userId, customerId, recordStatus: RECORD_STATUS.ACTIVE, status: { $ne: DOCUMENT_STATUS.VOID } } },
        { $sort: { date: 1, _id: 1 } },
        {
          $lookup: {
            from: 'inventory_deliveries',
            let: { saleId: '$_id', userId: '$userId' },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ['$saleId', '$$saleId'] }, { $eq: ['$userId', '$$userId'] }] } } },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
            as: 'deliveryLink',
          },
        },
        {
          $addFields: {
            isDelivery: { $or: [{ $eq: ['$orderChannel', 'delivery'] }, { $gt: [{ $size: '$deliveryLink' }, 0] }] },
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
            averageOrderValue: { $cond: [{ $gt: ['$paidOrders', 0] }, { $divide: ['$totalSpent', '$paidOrders'] }, 0] },
            averageDaysBetweenPurchases: {
              $let: {
                vars: { dates: { $filter: { input: '$purchaseDates', as: 'date', cond: { $ne: ['$$date', null] } } } },
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
      ])),
      withTimeout(Sale.countDocuments({ userId, customerId, recordStatus: RECORD_STATUS.ACTIVE, status: DOCUMENT_STATUS.VOID })),
    ]);

    return {
      customer,
      analytics: {
        ...(analyticsRows[0] || {
          totalOrders: 0,
          paidOrders: 0,
          deliveryOrders: 0,
          onSiteOrders: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          averageDaysBetweenPurchases: null,
          firstOrderAt: null,
          lastOrderAt: null,
        }),
        cancelledOrders,
      },
      history: {
        data: sales.map(({ _id, ...sale }) => ({ id: _id, ...sale })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }

  findCustomerForMetrics(userId, customerId, session = null) {
    let query = this.models.Customer.findOne({
      _id: customerId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });
    if (session) query = query.session(session);
    return withTimeout(query.lean());
  }

  updateCustomerMetrics(userId, customerId, metrics, session = null) {
    return withTimeout(this.models.Customer.updateOne(
      { _id: customerId, userId, recordStatus: RECORD_STATUS.ACTIVE },
      { $set: { ...metrics, updatedBy: userId } },
      session ? { session } : {},
    ));
  }
}

module.exports = { LoyaltyRepository };
