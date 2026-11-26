'use strict';

const { success, created, HttpError } = require('nemkit');
const { layawaysService } = require('./layaways.service');
const {
  createLayawaySchema,
  updateLayawaySchema,
  paymentSchema,
  deliverSchema,
  cancelSchema,
  authorizationSchema,
  settingsSchema,
} = require('./layaways.validator');

function actorOf(req) {
  return {
    actorId: req.user.actorId ?? req.user.id,
    fullName: req.user.fullName ?? '',
  };
}

class LayawaysController {
  async list(req, res, next) {
    try {
      const result = await layawaysService.list(req.user.id, req.query);
      return success(res, result.data, 'OK', 200, {
        pagination: result.pagination,
        summary: result.summary,
      });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      return success(res, await layawaysService.getDetail(req.params.id, req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = createLayawaySchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      const body = { ...req.body, ...sanitized };
      return created(
        res,
        await layawaysService.create(body, req.user.id, actorOf(req)),
        'Plan separe creado',
      );
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { errorResponse, sanitized } = updateLayawaySchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(
        res,
        await layawaysService.update(req.params.id, sanitized, req.user.id),
        'Plan separe actualizado',
      );
    } catch (error) {
      next(error);
    }
  }

  async addPayment(req, res, next) {
    try {
      const { errorResponse, sanitized } = paymentSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(
        res,
        await layawaysService.addPayment(req.params.id, sanitized, req.user.id, actorOf(req)),
        'Abono registrado',
      );
    } catch (error) {
      next(error);
    }
  }

  async deliver(req, res, next) {
    try {
      const { errorResponse, sanitized } = deliverSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(
        res,
        await layawaysService.deliver(req.params.id, sanitized, req.user.id, actorOf(req)),
        'Plan separe entregado',
      );
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const { errorResponse, sanitized } = cancelSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(
        res,
        await layawaysService.cancel(req.params.id, sanitized, req.user.id, actorOf(req)),
        'Plan separe cancelado',
      );
    } catch (error) {
      next(error);
    }
  }

  async authorize(req, res, next) {
    try {
      const { errorResponse, sanitized } = authorizationSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return created(
        res,
        await layawaysService.authorize(req.user.id, req.user.actorId ?? req.user.id, sanitized),
        'Autorización emitida',
      );
    } catch (error) {
      next(error);
    }
  }

  async getSettings(req, res, next) {
    try {
      return success(res, await layawaysService.getSettings(req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const { errorResponse, sanitized } = settingsSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      if (!Object.keys(sanitized).length) {
        throw HttpError.badRequest('At least one setting is required');
      }
      return success(
        res,
        await layawaysService.updateSettings(
          req.user.id,
          sanitized,
          req.user.actorId ?? req.user.id,
        ),
        'Configuración de Plan separe actualizada',
      );
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { layawaysController: new LayawaysController() };
