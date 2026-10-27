'use strict';

const { HttpError } = require('nemkit');
const { salesService } = require('../sales/sales.service');
const { deliveriesService } = require('../deliveries/deliveries.service');
const { positiveInteger } = require('../validation');
const { ORDER_STATUS, ORDER_STATUSES } = require('../inventory.constants');

/** Application boundary for kitchen operations over the Sales aggregate. */
class KitchenService {
  list(userId, options) {
    return salesService.listKitchenOrders(userId, options);
  }

  async changeStatus(saleId, status, userId, businessType, roles) {
    const id = positiveInteger(saleId, 'saleId');
    if (!ORDER_STATUSES.includes(status)) {
      throw HttpError.badRequest(`orderStatus must be one of: ${ORDER_STATUSES.join(', ')}`);
    }
    if (![ORDER_STATUS.PREPARING, ORDER_STATUS.READY, ORDER_STATUS.DELIVERED].includes(status)) {
      throw HttpError.badRequest('Preparation can only advance an order to preparing, ready, or delivered');
    }
    return salesService.advanceOrder(id, userId, status, businessType, roles);
  }

  cancel(saleId, userId, options) {
    return salesService.voidSale(saleId, userId, options);
  }
}

module.exports = { KitchenService, kitchenService: new KitchenService() };
