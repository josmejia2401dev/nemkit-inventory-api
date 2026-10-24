'use strict';

const { usersService } = require('../users/users.service');

class BusinessSettingsService {
  async update(tenantId, userId, settings) {
    const update = {};
    if (settings.companyName !== undefined) update.companyName = settings.companyName;
    if (settings.businessType !== undefined) update.businessType = settings.businessType;

    const user = await usersService.updateById(tenantId, update, userId);
    return {
      companyName: user.companyName ?? '',
      businessType: user.businessType ?? 'retail',
    };
  }
}

module.exports = { BusinessSettingsService, businessSettingsService: new BusinessSettingsService() };
