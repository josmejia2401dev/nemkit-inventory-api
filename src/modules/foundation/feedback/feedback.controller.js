'use strict';

const { success, created, paginated } = require('nemkit');
const { feedbackService } = require('./feedback.service');
const { feedbackCreateSchema, feedbackStatusSchema } = require('./feedback.validator');

class FeedbackController {
  /** POST /feedback — cualquier usuario autenticado reporta. */
  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = feedbackCreateSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      const feedback = await feedbackService.createForUser(sanitized, req.user);
      return created(res, feedback, 'Reporte enviado. ¡Gracias!');
    } catch (error) {
      next(error);
    }
  }

  /** GET /feedback — listado global (solo super admin). */
  async list(req, res, next) {
    try {
      const result = await feedbackService.listAll(req.query);
      return paginated(res, result.data, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  /** PUT /feedback/:id/status — cambiar estado de atención (solo super admin). */
  async changeStatus(req, res, next) {
    try {
      const { errorResponse, sanitized } = feedbackStatusSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      const feedback = await feedbackService.changeFeedbackStatus(req.params.id, sanitized.status, req.user.id);
      return success(res, feedback, 'Estado actualizado');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { FeedbackController, feedbackController: new FeedbackController() };
