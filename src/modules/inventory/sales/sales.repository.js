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

  async listKitchenOrders(userId, includeCompleted) {
    const filter = {
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      kitchenStatus: { $ne: null },
      status: { $ne: DOCUMENT_STATUS.VOID },
    };
    if (!includeCompleted) {
      const activeStatuses = [KITCHEN_STATUS.PENDING, KITCHEN_STATUS.PREPARING, KITCHEN_STATUS.READY];
      filter.$or = [
        { orderStatus: { $in: activeStatuses } },
        { orderStatus: { $in: [null] }, kitchenStatus: { $in: activeStatuses } },
      ];
    }

    const sales = await this._applyTimeout(this.model.find(filter)
      .select('_id date tableNumber orderChannel kitchenStatus orderStatus kitchenTimeline paymentStatus paidAt items total customerSnapshot employeeSnapshot notes')
      .sort({ date: 1 })
      .limit(200)
      .lean());
    return sales.map(({ _id, ...rest }) => ({
      id: _id,
      ...rest,
      orderStatus: rest.orderStatus ?? rest.kitchenStatus,
    }));
  }

  findKitchenSale(id, userId) {
    return this.findOne({ _id: id, userId, recordStatus: RECORD_STATUS.ACTIVE });
  }

  setOrderProgressInSession(id, userId, currentStatus, nextStatus, timeline, session) {
    const update = {
      orderStatus: nextStatus,
      updatedBy: userId,
    };
    for (const [field, value] of Object.entries(timeline)) {
      update[`kitchenTimeline.${field}`] = value;
    }
    const filter = {
      _id: id,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      status: { $ne: DOCUMENT_STATUS.VOID },
      $or: [
        { orderStatus: currentStatus },
        { orderStatus: null, kitchenStatus: currentStatus },
      ],
    };
    return this._applyTimeout(this.model.updateOne(filter, { $set: update }, { session }));
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


}

module.exports = { SalesRepository };
