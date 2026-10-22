'use strict';

const Product = require('../products/products.model');
const Category = require('../categories/categories.model');
const Movement = require('../movements/movements.model');
const { RECORD_STATUS } = require('nemkit');
const { PRODUCT_STATUS, MOVEMENT_TYPE } = require('../inventory.constants');

class DashboardService {
  async stockAlerts(userId) {
    const [outOfStock, lowStock] = await Promise.all([
      Product.countDocuments({
        userId,
        status: PRODUCT_STATUS.ACTIVE,
        stock: 0,
        recordStatus: RECORD_STATUS.ACTIVE,
      }),
      Product.countDocuments({
        userId,
        status: PRODUCT_STATUS.ACTIVE,
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

  async summary(userId) {
    const monthAgo = new Date(Date.now() - 30 * 86400000);

    const [
      totalProducts,
      stockAlerts,
      inventory,
      recentMovements,
      topSellingProducts,
    ] = await Promise.all([
      Product.countDocuments({
        userId,
        status: PRODUCT_STATUS.ACTIVE,
        recordStatus: RECORD_STATUS.ACTIVE,
      }),
      this.stockAlerts(userId),
      Product.aggregate([
        {
          $match: {
            userId,
            recordStatus: RECORD_STATUS.ACTIVE,
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
    };
  }
}

module.exports = {
  dashboardService: new DashboardService(),
};
