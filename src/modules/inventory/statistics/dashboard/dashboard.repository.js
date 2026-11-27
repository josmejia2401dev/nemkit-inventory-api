'use strict';

const { RECORD_STATUS } = require('nemkit');
const { withTimeout } = require('../shared/db');
const {
  DOCUMENT_STATUS,
  DELIVERY_STATUS,
  MOVEMENT_TYPE,
  PAYMENT_STATUS,
  PRODUCT_STATUS,
  LOYALTY_TIER,
} = require('../../inventory.constants');

class DashboardRepository {
  constructor(models) {
    this.models = models;
  }

  async dashboard(userId, since) {
    const { Product, Movement, Sale, Customer, Delivery, Layaway } = this.models;
    const physicalProducts = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    const activePhysicalProducts = { ...physicalProducts, status: PRODUCT_STATUS.ACTIVE };
    const activeMovements = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    const [totalProducts, outOfStock, lowStock, inventoryValueRows, recentMovements, topProducts, customers, topEmployees, deliveryStats, layaways] = await Promise.all([
      withTimeout(Product.countDocuments(activePhysicalProducts)),
      withTimeout(Product.countDocuments({ ...activePhysicalProducts, stock: 0 })),
      withTimeout(Product.countDocuments({
        ...activePhysicalProducts,
        $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$minimumStock'] }] },
      })),
      withTimeout(Product.aggregate([
        { $match: physicalProducts },
        { $group: { _id: null, value: { $sum: { $multiply: ['$stock', '$purchasePrice'] } } } },
      ])),
      withTimeout(Movement.find(activeMovements).sort({ date: -1 }).limit(10).lean()),
      withTimeout(Movement.aggregate([
        { $match: { ...activeMovements, type: MOVEMENT_TYPE.SALE, date: { $gte: since } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', unitsSold: { $sum: '$items.quantity' } } },
        { $sort: { unitsSold: -1 } },
        { $limit: 5 },
      ])),
      this.#customerDashboard(Customer, userId, since),
      this.#employeeDashboard(Sale, userId, since),
      this.#deliveryDashboard(Delivery, userId),
      this.#layawayDashboard(Layaway, userId),
    ]);

    const productIds = topProducts.map((row) => row._id);
    const products = productIds.length
      ? await withTimeout(Product.find({ userId, _id: { $in: productIds }, status: PRODUCT_STATUS.ACTIVE, recordStatus: RECORD_STATUS.ACTIVE }).select('_id name sku').lean())
      : [];
    const productById = new Map(products.map((product) => [product._id, product]));

    return {
      totalProducts,
      outOfStock,
      lowStock,
      inventoryValue: inventoryValueRows[0]?.value || 0,
      recentMovements: recentMovements.map(({ _id, userId: _userId, ...movement }) => ({ id: _id, ...movement })),
      topSellingProducts: topProducts.flatMap((row) => {
        const product = productById.get(row._id);
        return product ? [{ productId: row._id, name: product.name, sku: product.sku, unitsSold: row.unitsSold }] : [];
      }),
      customers,
      topEmployees,
      deliveries: deliveryStats,
      layaways,
    };
  }

  async #customerDashboard(Customer, userId, since) {
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    const [total, newCustomers, frequent, vip] = await Promise.all([
      withTimeout(Customer.countDocuments(filter)),
      withTimeout(Customer.countDocuments({ ...filter, createdAt: { $gte: since } })),
      withTimeout(Customer.countDocuments({ ...filter, 'stats.purchaseCount': { $gte: 5 } })),
      withTimeout(Customer.countDocuments({ ...filter, loyaltyTier: { $in: [LOYALTY_TIER.GOLD, LOYALTY_TIER.PLATINUM] } })),
    ]);
    return { total, new: newCustomers, frequent, vip };
  }

  #employeeDashboard(Sale, userId, since) {
    return withTimeout(Sale.aggregate([
      { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: { $ne: DOCUMENT_STATUS.VOID }, paymentStatus: PAYMENT_STATUS.PAID, date: { $gte: since } } },
      { $group: { _id: '$employeeId', employeeName: { $last: '$employeeSnapshot.name' }, salesCount: { $sum: 1 }, revenue: { $sum: '$total' } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, employeeId: '$_id', employeeName: 1, salesCount: 1, revenue: 1 } },
    ]));
  }


  async #layawayDashboard(Layaway, userId) {
    const now = new Date();
    const [row] = await withTimeout(Layaway.aggregate([
      {
        $match: {
          userId,
          recordStatus: RECORD_STATUS.ACTIVE,
          status: { $in: ['active', 'ready'] },
        },
      },
      {
        $group: {
          _id: null,
          activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          activeBalance: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, '$balance', 0] } },
          overdueCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'active'] },
                    { $gt: ['$balance', 0] },
                    { $lt: ['$dueDate', now] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          readyCount: { $sum: { $cond: [{ $eq: ['$status', 'ready'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]));
    return row ?? { activeCount: 0, activeBalance: 0, overdueCount: 0, readyCount: 0 };
  }

  async #deliveryDashboard(Delivery, userId) {
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    const [byStatus, average] = await Promise.all([
      withTimeout(Delivery.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }])),
      withTimeout(Delivery.aggregate([
        { $match: { ...filter, status: DELIVERY_STATUS.DELIVERED, 'timeline.deliveredAt': { $ne: null } } },
        { $project: { minutes: { $divide: [{ $subtract: ['$timeline.deliveredAt', '$createdAt'] }, 60000] } } },
        { $group: { _id: null, avgMinutes: { $avg: '$minutes' } } },
      ])),
    ]);
    const counts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
    return {
      pending: counts[DELIVERY_STATUS.PENDING] || 0,
      onRoute: counts[DELIVERY_STATUS.ON_ROUTE] || 0,
      delivered: counts[DELIVERY_STATUS.DELIVERED] || 0,
      cancelled: counts[DELIVERY_STATUS.CANCELLED] || 0,
      avgDeliveryMinutes: average[0]?.avgMinutes != null ? Math.round(average[0].avgMinutes) : null,
    };
  }

  async stockAlerts(userId) {
    const { Product, Category } = this.models;
    const products = await withTimeout(Product.find({
      userId,
      status: PRODUCT_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
      $or: [
        { stock: 0 },
        { $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$minimumStock'] }] } },
      ],
    }).select('_id name sku stock minimumStock categoryId').sort({ stock: 1, name: 1 }).lean());
    const categoryIds = [...new Set(products.map((product) => product.categoryId))];
    const categories = categoryIds.length
      ? await withTimeout(Category.find({ userId, _id: { $in: categoryIds }, recordStatus: RECORD_STATUS.ACTIVE }).select('_id name').lean())
      : [];
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
}

module.exports = { DashboardRepository };
