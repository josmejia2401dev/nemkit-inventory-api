'use strict';

const { success } = require('nemkit');
const { loyaltyService } = require('./loyalty.service');
const { customerProfileQuerySchema } = require('./loyalty.validator');

function check(schema, req, res) {
  const result = schema.check(req.query ?? {}, req);
  if (result.errorResponse) {
    res.status(400).json(result.errorResponse);
    return null;
  }
  return result.sanitized;
}

class LoyaltyController {
  async customerProfile(req, res, next) {
    try {
      const query = check(customerProfileQuerySchema, req, res);
      if (!query) return;
      return success(res, await loyaltyService.customerProfile(req.params.id, req.user.id, query));
    } catch (error) {
      next(error);
    }
  }

  async customerLoyaltyRules(req, res, next) {
    try {
      return success(res, loyaltyService.customerLoyaltyRules());
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { loyaltyController: new LoyaltyController() };
