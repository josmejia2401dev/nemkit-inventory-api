'use strict';

const { success } = require('nemkit');
const { limitsService } = require('./limits.service');

class LimitsController {
  async get(req, res, next) {
    try {
      // `/limits` se monta en foundation y no pasa por `scopeToUser`: en sesiones
      // de empleado `id` es el empleado y `userId` el dueño de la empresa.
      return success(res, await limitsService.getLimitUsage(req.user.userId ?? req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async plans(_req, res, next) {
    try {
      return success(res, limitsService.getPlans());
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { LimitsController, limitsController: new LimitsController() };
