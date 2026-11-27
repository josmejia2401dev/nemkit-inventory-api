'use strict';

const { RECORD_STATUS } = require('nemkit');
const { InventoryDocumentRepository } = require('../documents/document.repository');
const Sale = require('./sales.model');
const { PAYMENT_STATUS } = require('../inventory.constants');

class SalesRepository extends InventoryDocumentRepository {
  constructor() {
    super(Sale);
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

  findByLayawayInSession(userId, layawayId, session) {
    return this.model.findOne({
      userId,
      layawayId,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).session(session).lean();
  }

  markLayawaySalePaidInSession(saleId, userId, paidAt, session) {
    return this.model.updateOne(
      { _id: saleId, userId, recordStatus: RECORD_STATUS.ACTIVE },
      { $set: { paymentStatus: PAYMENT_STATUS.PAID, paidAt, updatedBy: userId } },
      { session },
    );
  }
}

module.exports = { SalesRepository };
