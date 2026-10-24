'use strict';

const { HttpError } = require('nemkit');
const { salesService } = require('../sales/sales.service');
const { deliveriesService } = require('../deliveries/deliveries.service');
const { positiveInteger } = require('../validation');
const {
  KITCHEN_STATUS,
  KITCHEN_STATUSES,
  KITCHEN_TRANSITIONS,
} = require('../inventory.constants');

/** Application boundary for kitchen operations over the Sales aggregate. */
class KitchenService {
  list(userId, options) {
    return salesService.listKitchenOrders(userId, options);
  }

  async changeStatus(saleId, status, userId) {
    const id = positiveInteger(saleId, 'saleId');
    if (!KITCHEN_STATUSES.includes(status)) {
      throw HttpError.badRequest(`kitchenStatus must be one of: ${KITCHEN_STATUSES.join(', ')}`);
    }

    const sale = await salesService.getKitchenSale(id, userId);
    if (sale.kitchenStatus == null) throw HttpError.badRequest('This sale is not a kitchen order');
    if (status === 'served' && await deliveriesService.existsForSale(id, userId)) {
      throw HttpError.conflict('A delivery order must be handed off to the courier, not marked as served');
    }

    const allowed = KITCHEN_TRANSITIONS[sale.kitchenStatus] ?? [];
    if (!allowed.includes(status)) {
      throw HttpError.conflict(`Cannot change kitchen status from ${sale.kitchenStatus} to ${status}`);
    }

    const timeline = {};
    if (status === KITCHEN_STATUS.PREPARING) timeline.startedAt = new Date();
    if (status === KITCHEN_STATUS.READY) timeline.readyAt = new Date();
    if (status === KITCHEN_STATUS.SERVED) timeline.servedAt = new Date();

    return salesService.setKitchenState(
      id,
      userId,
      sale.kitchenStatus,
      status,
      timeline,
    );
  }

  cancel(saleId, userId, options) {
    return salesService.voidSale(saleId, userId, options);
  }
}

module.exports = { KitchenService, kitchenService: new KitchenService() };
