'use strict';

const { LOYALTY_TIER } = require('../inventory.constants');

/** Thresholds for assigning a customer loyalty tier, from highest to lowest. */
const LOYALTY_TIER_RULES = Object.freeze([
  { tier: LOYALTY_TIER.PLATINUM, minSpent: 2000000, minPurchases: 40 },
  { tier: LOYALTY_TIER.GOLD, minSpent: 800000, minPurchases: 15 },
  { tier: LOYALTY_TIER.SILVER, minSpent: 200000, minPurchases: 5 },
  { tier: LOYALTY_TIER.BRONZE, minSpent: 0, minPurchases: 0 },
]);

function resolveLoyaltyTier(totalSpent = 0, purchaseCount = 0) {
  for (const rule of LOYALTY_TIER_RULES) {
    if (totalSpent >= rule.minSpent || purchaseCount >= rule.minPurchases) {
      return rule.tier;
    }
  }
  return LOYALTY_TIER.BRONZE;
}

module.exports = { LOYALTY_TIER_RULES, resolveLoyaltyTier };
