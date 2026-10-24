'use strict';

const { success } = require('nemkit');
const { businessSettingsService } = require('./business-settings.service');
const { businessSettingsSchema } = require('./business-settings.validator');

class BusinessSettingsController {
  async update(req, res, next) {
    try {
      const { errorResponse, sanitized } = businessSettingsSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);

      const tenantId = req.user.tenantId ?? req.user.id;
      const settings = await businessSettingsService.update(tenantId, req.user.id, sanitized);
      return success(res, settings, 'Business settings updated. Sign in again to apply the new mode.');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { BusinessSettingsController, businessSettingsController: new BusinessSettingsController() };
