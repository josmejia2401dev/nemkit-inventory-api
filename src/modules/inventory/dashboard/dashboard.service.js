'use strict';

const Product = require('../products/products.model');
const Category = require('../categories/categories.model');
const Movement = require('../movements/movements.model');
const Customer = require('../customers/customers.model');
const Sale = require('../sales/sales.model');
const Delivery = require('../deliveries/deliveries.model');
const { RECORD_STATUS } = require('nemkit');
const {
  PRODUCT_STATUS,
  PRODUCT_TYPE,
  MOVEMENT_TYPE,
  DOCUMENT_STATUS,
  PAYMENT_STATUS,
  LOYALTY_TIER,
  DELIVERY_STATUS,
} = require('../inventory.constants');

class DashboardService {
  async stockAlerts(userId) {
    const notPrepared = { $ne: PRODUCT_TYPE.PREPARED };
    const [outOfStock, lowStock] = await Promise.all([
      Product.countDocuments({
        userId,
        status: PRODUCT_STATUS.ACTIVE,
        type: notPrepared,
        stock: 0,
        recordStatus: RECORD_STATUS.ACTIVE,
      }),
      Product.countDocuments({
        userId,
        status: PRODUCT_STATUS.ACTIVE,
        type: notPrepared,
        $expr: {
          $and: [
            { $gt: ['$stock', 0] },
            { $lte: ['$stock', '$minimumStock'] },
          ],
        },
        recordStatus: RECORD_STATUS.ACTIVE,
      }),
    ]);

    return { outOfStock, lowStock };
  }

  async stockAlertDetails(userId) {
    const products = await Product.find({
      userId,
      status: PRODUCT_STATUS.ACTIVE,
      type: { $ne: PRODUCT_TYPE.PREPARED },
      recordStatus: RECORD_STATUS.ACTIVE,
      $or: [
        { stock: 0 },
        { $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$minimumStock'] }] } },
      ],
    })
      .select('_id name sku stock minimumStock categoryId')
      .sort({ stock: 1, name: 1 })
      .lean();

    const categoryIds = [...new Set(products.map((product) => product.categoryId))];
    const categories = await Category.find({
      _id: { $in: categoryIds },
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id name').lean();
    const categoryNames = new Map(categories.map((category) => [category._id, category.name]));
    const items = products.map((product) => ({
      id: product._id,
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      minimumStock: product.minimumStock,
      categoryName: categoryNames.get(product.categoryId) || '',
      state: product.stock === 0 ? 'out_of_stock' : 'low_stock',
    }));

    return {
      outOfStock: items.filter((product) => product.state === 'out_of_stock').length,
      lowStock: items.filter((product) => product.state === 'low_stock').length,
      products: items,
    };
  }

  async customerMetrics(userId, since) {
    const [newCustomers, frequent, vip, total] = await Promise.all([
      Customer.countDocuments({ userId, recordStatus: RECORD_STATUS.ACTIVE, createdAt: { $gte: since } }),
      Customer.countDocuments({ userId, recordStatus: RECORD_STATUS.ACTIVE, 'stats.purchaseCount': { $gte: 5 } }),
      Customer.countDocuments({
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
        loyaltyTier: { $in: [LOYALTY_TIER.GOLD, LOYALTY_TIER.PLATINUM] },
      }),
      Customer.countDocuments({ userId, recordStatus: RECORD_STATUS.ACTIVE }),
    ]);
    return { total, new: newCustomers, frequent, vip };
  }

  async employeeSales(userId, since) {
    const rows = await Sale.aggregate([
      { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: { $ne: DOCUMENT_STATUS.VOID }, paymentStatus: PAYMENT_STATUS.PAID, date: { $gte: since }, employeeId: { $ne: null } } },
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
    ]);
    return rows.map((row) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName || `Empleado #${row.employeeId}`,
      salesCount: row.salesCount,
      revenue: this.#roundMoney(row.revenue),
    }));
  }

  async deliveryMetrics(userId) {
    const [byStatus, avg] = await Promise.all([
      Delivery.aggregate([
        { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Delivery.aggregate([
        {
          $match: {
            userId,
            recordStatus: RECORD_STATUS.ACTIVE,
            status: DELIVERY_STATUS.DELIVERED,
            'timeline.deliveredAt': { $ne: null },
          },
        },
        {
          $project: {
            minutes: { $divide: [{ $subtract: ['$timeline.deliveredAt', '$createdAt'] }, 60000] },
          },
        },
        { $group: { _id: null, avgMinutes: { $avg: '$minutes' } } },
      ]),
    ]);

    const counts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
    return {
      pending: counts[DELIVERY_STATUS.PENDING] || 0,
      preparing: counts[DELIVERY_STATUS.PREPARING] || 0,
      onRoute: counts[DELIVERY_STATUS.ON_ROUTE] || 0,
      delivered: counts[DELIVERY_STATUS.DELIVERED] || 0,
      cancelled: counts[DELIVERY_STATUS.CANCELLED] || 0,
      avgDeliveryMinutes: avg[0]?.avgMinutes != null ? Math.round(avg[0].avgMinutes) : null,
    };
  }

  async summary(userId) {
    const monthAgo = new Date(Date.now() - 30 * 86400000);

    const [
      totalProducts,
      stockAlerts,
      inventory,
      recentMovements,
      topSellingProducts,
      customers,
      topEmployees,
      deliveries,
    ] = await Promise.all([
      Product.countDocuments({
        userId,
        status: PRODUCT_STATUS.ACTIVE,
        type: { $ne: PRODUCT_TYPE.PREPARED },
        recordStatus: RECORD_STATUS.ACTIVE,
      }),
      this.stockAlerts(userId),
      Product.aggregate([
        {
          $match: {
            userId,
            recordStatus: RECORD_STATUS.ACTIVE,
            type: { $ne: PRODUCT_TYPE.PREPARED },
          },
        },
        {
          $group: {
            _id: null,
            value: {
              $sum: {
                $multiply: ['$stock', '$purchasePrice'],
              },
            },
          },
        },
      ]),
      Movement.find({
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
      })
        .sort({ date: -1 })
        .limit(10)
        .lean(),
      Movement.aggregate([
        {
          $match: {
            userId,
            type: MOVEMENT_TYPE.SALE,
            date: { $gte: monthAgo },
            recordStatus: RECORD_STATUS.ACTIVE,
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            unitsSold: { $sum: '$items.quantity' },
          },
        },
        { $sort: { unitsSold: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: Product.collection.name,
            let: { productId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$productId'] },
                      { $eq: ['$userId', userId] },
                      { $eq: ['$status', PRODUCT_STATUS.ACTIVE] },
                      { $eq: ['$recordStatus', RECORD_STATUS.ACTIVE] },
                    ],
                  },
                },
              },
              { $project: { name: 1, sku: 1 } },
            ],
            as: 'product',
          },
        },
        { $unwind: '$product' },
        {
          $project: {
            productId: '$_id',
            name: '$product.name',
            sku: '$product.sku',
            unitsSold: 1,
            _id: 0,
          },
        },
      ]),
      this.customerMetrics(userId, monthAgo),
      this.employeeSales(userId, monthAgo),
      this.deliveryMetrics(userId),
    ]);

    return {
      totalProducts,
      outOfStock: stockAlerts.outOfStock,
      lowStock: stockAlerts.lowStock,
      inventoryValue: inventory[0]?.value || 0,
      recentMovements: recentMovements.map(({ _id, userId: _userId, ...movement }) => ({
        id: _id,
        ...movement,
      })),
      topSellingProducts,
      customers,
      topEmployees,
      deliveries,
    };
  }

  #roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

module.exports = {
  dashboardService: new DashboardService(),
};
