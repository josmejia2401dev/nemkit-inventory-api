'use strict';

const { RECORD_STATUS } = require('nemkit');
const { applyMongoTimeout } = require('../../../config/mongo-query');
const {
  DOCUMENT_STATUS,
  DELIVERY_STATUS,
  MOVEMENT_TYPE,
  PAYMENT_STATUS,
  PRODUCT_STATUS,
  PRODUCT_TYPE,
  LOYALTY_TIER,
} = require('../inventory.constants');

const QUERY_TIMEOUT_MS = 30000;
const REPORT_TIMEZONE = 'America/Bogota';

class StatisticsRepository {
  constructor(models) {
    this.models = models;
  }

  #query(operation) {
    return applyMongoTimeout(operation, QUERY_TIMEOUT_MS);
  }

  async customerProfile(userId, customerId, { page, limit }) {
    const { Customer, Sale } = this.models;
    const [customer, [sales, total], analyticsRows, cancelledOrders] = await Promise.all([
      this.#query(Customer.findOne({ _id: customerId, userId, recordStatus: RECORD_STATUS.ACTIVE }).lean()),
      Promise.all([
        this.#query(Sale.find({ userId, customerId, recordStatus: RECORD_STATUS.ACTIVE })
          .select('_id date total items employeeSnapshot paymentStatus orderStatus kitchenStatus tableNumber status voidReason voidNote voidedAt')
          .sort({ date: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean()),
        this.#query(Sale.countDocuments({ userId, customerId, recordStatus: RECORD_STATUS.ACTIVE })),
      ]),
      this.#query(Sale.aggregate([
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
      this.#query(Sale.countDocuments({ userId, customerId, recordStatus: RECORD_STATUS.ACTIVE, status: DOCUMENT_STATUS.VOID })),
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
    return this.#query(query.lean());
  }

  updateCustomerMetrics(userId, customerId, metrics, session = null) {
    return this.#query(this.models.Customer.updateOne(
      { _id: customerId, userId, recordStatus: RECORD_STATUS.ACTIVE },
      { $set: { ...metrics, updatedBy: userId } },
      session ? { session } : {},
    ));
  }

  async dashboard(userId, since) {
    const { Product, Movement, Sale, Customer, Delivery } = this.models;
    const physicalProducts = { userId, type: { $ne: PRODUCT_TYPE.PREPARED }, recordStatus: RECORD_STATUS.ACTIVE };
    const activePhysicalProducts = { ...physicalProducts, status: PRODUCT_STATUS.ACTIVE };
    const activeMovements = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    const [totalProducts, outOfStock, lowStock, inventoryValueRows, recentMovements, topProducts, customers, topEmployees, deliveryStats] = await Promise.all([
      this.#query(Product.countDocuments(activePhysicalProducts)),
      this.#query(Product.countDocuments({ ...activePhysicalProducts, stock: 0 })),
      this.#query(Product.countDocuments({
        ...activePhysicalProducts,
        $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$minimumStock'] }] },
      })),
      this.#query(Product.aggregate([
        { $match: physicalProducts },
        { $group: { _id: null, value: { $sum: { $multiply: ['$stock', '$purchasePrice'] } } } },
      ])),
      this.#query(Movement.find(activeMovements).sort({ date: -1 }).limit(10).lean()),
      this.#query(Movement.aggregate([
        { $match: { ...activeMovements, type: MOVEMENT_TYPE.SALE, date: { $gte: since } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', unitsSold: { $sum: '$items.quantity' } } },
        { $sort: { unitsSold: -1 } },
        { $limit: 5 },
      ])),
      this.#customerDashboard(Customer, userId, since),
      this.#employeeDashboard(Sale, userId, since),
      this.#deliveryDashboard(Delivery, userId),
    ]);

    const productIds = topProducts.map((row) => row._id);
    const products = productIds.length
      ? await this.#query(Product.find({ userId, _id: { $in: productIds }, status: PRODUCT_STATUS.ACTIVE, recordStatus: RECORD_STATUS.ACTIVE }).select('_id name sku').lean())
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
    };
  }

  async #customerDashboard(Customer, userId, since) {
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    const [total, newCustomers, frequent, vip] = await Promise.all([
      this.#query(Customer.countDocuments(filter)),
      this.#query(Customer.countDocuments({ ...filter, createdAt: { $gte: since } })),
      this.#query(Customer.countDocuments({ ...filter, 'stats.purchaseCount': { $gte: 5 } })),
      this.#query(Customer.countDocuments({ ...filter, loyaltyTier: { $in: [LOYALTY_TIER.GOLD, LOYALTY_TIER.PLATINUM] } })),
    ]);
    return { total, new: newCustomers, frequent, vip };
  }

  #employeeDashboard(Sale, userId, since) {
    return this.#query(Sale.aggregate([
      { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: { $ne: DOCUMENT_STATUS.VOID }, paymentStatus: PAYMENT_STATUS.PAID, date: { $gte: since } } },
      { $group: { _id: '$employeeId', employeeName: { $last: '$employeeSnapshot.name' }, salesCount: { $sum: 1 }, revenue: { $sum: '$total' } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, employeeId: '$_id', employeeName: 1, salesCount: 1, revenue: 1 } },
    ]));
  }

  async #deliveryDashboard(Delivery, userId) {
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    const [byStatus, average] = await Promise.all([
      this.#query(Delivery.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }])),
      this.#query(Delivery.aggregate([
        { $match: { ...filter, status: DELIVERY_STATUS.DELIVERED, 'timeline.deliveredAt': { $ne: null } } },
        { $project: { minutes: { $divide: [{ $subtract: ['$timeline.deliveredAt', '$createdAt'] }, 60000] } } },
        { $group: { _id: null, avgMinutes: { $avg: '$minutes' } } },
      ])),
    ]);
    const counts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
    return {
      pending: counts[DELIVERY_STATUS.PENDING] || 0,
      preparing: counts[DELIVERY_STATUS.PREPARING] || 0,
      onRoute: counts[DELIVERY_STATUS.ON_ROUTE] || 0,
      delivered: counts[DELIVERY_STATUS.DELIVERED] || 0,
      cancelled: counts[DELIVERY_STATUS.CANCELLED] || 0,
      avgDeliveryMinutes: average[0]?.avgMinutes != null ? Math.round(average[0].avgMinutes) : null,
    };
  }

  async stockAlerts(userId) {
    const { Product, Category } = this.models;
    const products = await this.#query(Product.find({
      userId,
      status: PRODUCT_STATUS.ACTIVE,
      type: { $ne: PRODUCT_TYPE.PREPARED },
      recordStatus: RECORD_STATUS.ACTIVE,
      $or: [
        { stock: 0 },
        { $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$minimumStock'] }] } },
      ],
    }).select('_id name sku stock minimumStock categoryId').sort({ stock: 1, name: 1 }).lean());
    const categoryIds = [...new Set(products.map((product) => product.categoryId))];
    const categories = categoryIds.length
      ? await this.#query(Category.find({ userId, _id: { $in: categoryIds }, recordStatus: RECORD_STATUS.ACTIVE }).select('_id name').lean())
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

  async inventoryReport(userId) {
    const { Product, Category } = this.models;
    const products = await this.#query(Product.find({ userId, recordStatus: RECORD_STATUS.ACTIVE })
      .select('_id sku name categoryId purchasePrice salePrice stock minimumStock status')
      .sort({ name: 1 })
      .lean());
    const categoryIds = [...new Set(products.map((product) => product.categoryId))];
    const categories = categoryIds.length
      ? await this.#query(Category.find({ userId, _id: { $in: categoryIds }, recordStatus: RECORD_STATUS.ACTIVE }).select('_id name').lean())
      : [];
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

  async movementsReport(userId, filter, { page, limit }) {
    const { Movement, Product } = this.models;
    const [documents, total] = await Promise.all([
      this.#query(Movement.find(filter).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()),
      this.#query(Movement.countDocuments(filter)),
    ]);
    const productIds = [...new Set(documents.flatMap((movement) => movement.items.map((item) => item.productId)))];
    const products = productIds.length
      ? await this.#query(Product.find({ userId, _id: { $in: productIds } }).select('_id name sku').lean())
      : [];
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
    };
  }

  reportSales(userId, from, toExclusive, groupBy, employeeId = null) {
    const match = {
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      status: { $ne: DOCUMENT_STATUS.VOID },
      paymentStatus: PAYMENT_STATUS.PAID,
      date: { $gte: from, $lt: toExclusive },
    };
    if (employeeId !== null) match.employeeId = employeeId;
    return this.#query(this.models.Sale.aggregate([
      { $match: match },
      { $addFields: { unitsSold: { $sum: '$items.quantity' }, grossProfit: this.#grossProfitExpression(), period: { $dateTrunc: { date: '$date', unit: groupBy, ...(groupBy === 'week' ? { startOfWeek: 'monday' } : {}), timezone: REPORT_TIMEZONE } } } },
      { $facet: {
        periods: [
          { $group: { _id: '$period', salesCount: { $sum: 1 }, unitsSold: { $sum: '$unitsSold' }, revenue: { $sum: '$total' }, grossProfit: { $sum: '$grossProfit' } } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, periodStart: '$_id', salesCount: 1, unitsSold: 1, revenue: 1, grossProfit: 1 } },
        ],
        totals: [
          { $group: { _id: null, salesCount: { $sum: 1 }, unitsSold: { $sum: '$unitsSold' }, revenue: { $sum: '$total' }, grossProfit: { $sum: '$grossProfit' } } },
          { $project: { _id: 0 } },
        ],
      } },
    ]));
  }

  reportSalesByEmployee(userId, from, toExclusive) {
    const { Sale, EmployeePayment } = this.models;
    return Promise.all([
      this.#query(Sale.aggregate([
        { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: { $ne: DOCUMENT_STATUS.VOID }, date: { $gte: from, $lt: toExclusive } } },
        { $addFields: { unitsSold: { $sum: '$items.quantity' }, grossProfit: this.#grossProfitExpression() } },
        { $group: {
          _id: '$employeeId',
          employeeName: { $last: '$employeeSnapshot.name' },
          salesCount: { $sum: 1 },
          unitsSold: { $sum: '$unitsSold' },
          revenue: { $sum: '$total' },
          collectedValue: { $sum: { $cond: [{ $eq: ['$paymentStatus', PAYMENT_STATUS.PAID] }, '$total', 0] } },
          pendingValue: { $sum: { $cond: [{ $eq: ['$paymentStatus', PAYMENT_STATUS.PENDING] }, '$total', 0] } },
          grossProfit: { $sum: '$grossProfit' },
        } },
        { $sort: { revenue: -1 } },
        { $project: { _id: 0, employeeId: '$_id', employeeName: 1, salesCount: 1, unitsSold: 1, revenue: 1, collectedValue: 1, pendingValue: 1, grossProfit: 1 } },
      ])),
      this.#query(Sale.aggregate([
        { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: { $ne: DOCUMENT_STATUS.VOID }, paymentStatus: PAYMENT_STATUS.PAID, paidAt: { $gte: from, $lt: toExclusive } } },
        { $group: { _id: '$employeeId', employeeName: { $last: '$employeeSnapshot.name' }, collectionsCount: { $sum: 1 }, collectedInPeriod: { $sum: '$total' } } },
        { $project: { _id: 0, employeeId: '$_id', employeeName: 1, collectionsCount: 1, collectedInPeriod: 1 } },
      ])),
      this.#query(Sale.aggregate([
        { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: DOCUMENT_STATUS.VOID, voidedAt: { $gte: from, $lt: toExclusive } } },
        { $addFields: {
          cancellationActorId: { $ifNull: ['$voidedBy', '$employeeId'] },
          cancellationActorName: { $cond: [{ $ne: ['$voidedBy', null] }, '$voidedBySnapshot.name', '$employeeSnapshot.name'] },
        } },
        { $group: { _id: '$cancellationActorId', employeeName: { $last: '$cancellationActorName' }, cancellationCount: { $sum: 1 }, cancelledValue: { $sum: '$total' } } },
        { $project: { _id: 0, employeeId: '$_id', employeeName: 1, cancellationCount: 1, cancelledValue: 1 } },
      ])),
      this.#employeePaymentSummary(EmployeePayment, userId, from, toExclusive),
    ]);
  }

  #employeePaymentSummary(EmployeePayment, userId, from, toExclusive, employeeId = null) {
    const match = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    if (from || toExclusive) {
      match.paymentDate = {};
      if (from) match.paymentDate.$gte = from;
      if (toExclusive) match.paymentDate.$lt = toExclusive;
    }
    if (employeeId !== null) match.employeeId = employeeId;
    return this.#query(EmployeePayment.aggregate([
      { $match: match },
      { $group: { _id: '$employeeId', employeeName: { $last: '$employeeSnapshot.name' }, paymentCount: { $sum: 1 }, totalPaid: { $sum: '$amount' } } },
      { $sort: { totalPaid: -1, employeeName: 1 } },
      { $project: { _id: 0, employeeId: '$_id', employeeName: 1, paymentCount: 1, totalPaid: 1 } },
    ]));
  }

  employeePaymentSummary(userId, from, toExclusive, employeeId = null) {
    return this.#employeePaymentSummary(this.models.EmployeePayment, userId, from, toExclusive, employeeId);
  }

  cancelledSales(userId, from, toExclusive, { page, limit }) {
    return this.#query(this.models.Sale.aggregate([
      { $match: { userId, recordStatus: RECORD_STATUS.ACTIVE, status: DOCUMENT_STATUS.VOID, voidedAt: { $gte: from, $lt: toExclusive } } },
      { $facet: {
        cancellations: [
          { $sort: { voidedAt: -1, _id: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: { _id: 1, date: '$voidedAt', saleDate: '$date', total: 1, customerSnapshot: 1, employeeSnapshot: 1, voidedBy: 1, voidedBySnapshot: 1, voidReason: 1, voidNote: 1 } },
        ],
        totals: [{ $group: { _id: null, cancellationCount: { $sum: 1 }, cancelledValue: { $sum: '$total' } } }, { $project: { _id: 0, cancellationCount: 1, cancelledValue: 1 } }],
        count: [{ $count: 'total' }],
      } },
    ]));
  }

  #grossProfitExpression() {
    return {
      $reduce: {
        input: '$items',
        initialValue: 0,
        in: { $add: ['$$value', { $multiply: [{ $subtract: ['$$this.unitPrice', '$$this.unitCost'] }, '$$this.quantity'] }] },
      },
    };
  }

  #roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

module.exports = { StatisticsRepository };
