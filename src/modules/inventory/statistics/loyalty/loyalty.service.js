'use strict';

const { HttpError } = require('nemkit');
const { LoyaltyRepository } = require('./loyalty.repository');
const models = require('../statistics.models');
const { LOYALTY_TIER_RULES, resolveLoyaltyTier } = require('./loyalty.constants');
const { positiveInteger } = require('../../validation');
const { roundMoney } = require('../shared/aggregations');

class LoyaltyService {
  constructor(repository = new LoyaltyRepository(models)) {
    this.repository = repository;
  }

  customerLoyaltyRules() {
    return LOYALTY_TIER_RULES;
  }

  async recordCustomerPurchase(customer, amount, date, userId, session = null) {
    const previousSpent = customer.stats?.totalSpent ?? 0;
    const previousCount = customer.stats?.purchaseCount ?? 0;
    const totalSpent = roundMoney(previousSpent + amount);
    const purchaseCount = previousCount + 1;
    return this.repository.updateCustomerMetrics(userId, customer._id, {
      'stats.totalSpent': totalSpent,
      'stats.purchaseCount': purchaseCount,
      'stats.firstPurchaseAt': customer.stats?.firstPurchaseAt ?? date,
      'stats.lastPurchaseAt': date,
      loyaltyTier: resolveLoyaltyTier(totalSpent, purchaseCount),
    }, session);
  }

  async reverseCustomerPurchase(customerId, amount, userId, session = null) {
    const customer = await this.repository.findCustomerForMetrics(userId, customerId, session);
    if (!customer) return false;
    const totalSpent = Math.max(0, roundMoney((customer.stats?.totalSpent ?? 0) - amount));
    const purchaseCount = Math.max(0, (customer.stats?.purchaseCount ?? 0) - 1);
    await this.repository.updateCustomerMetrics(userId, customer._id, {
      'stats.totalSpent': totalSpent,
      'stats.purchaseCount': purchaseCount,
      loyaltyTier: resolveLoyaltyTier(totalSpent, purchaseCount),
    }, session);
    return true;
  }

  async customerProfile(customerId, userId, query = {}) {
    const id = positiveInteger(customerId, 'customerId');
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const profile = await this.repository.customerProfile(userId, id, { page, limit });
    if (!profile.customer) throw HttpError.notFound('Customer not found');
    return { ...profile, loyaltyRules: LOYALTY_TIER_RULES };
  }
}

module.exports = { LoyaltyService, loyaltyService: new LoyaltyService() };
