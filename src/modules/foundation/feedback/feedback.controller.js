'use strict';

const { success, created, paginated, createValidator } = require('nemkit');
const { feedbackService } = require('./feedback.service');
const Feedback = require('./feedback.model');

const createSchema = createValidator({
  title: { type: 'string', required: true, trim: true, minLength: 3, maxLength: 160 },
  description: { type: 'string', required: true, trim: true, minLength: 3, maxLength: 4000 },
  type: { type: 'string', enum: Feedback.FEEDBACK_TYPES },
});

const statusSchema = createValidator({
  status: { type: 'string', required: true, enum: Feedback.FEEDBACK_STATUSES },
});

class FeedbackController {
  /** POST /feedback — cualquier usuario autenticado reporta. */
  async create(req, res, next) {
    try {
      const { errorResponse, sanitized } = createSchema.check(req.body ?? {}, req);
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
      const { errorResponse, sanitized } = statusSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      const feedback = await feedbackService.changeFeedbackStatus(req.params.id, sanitized.status, req.user.id);
      return success(res, feedback, 'Estado actualizado');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { FeedbackController, feedbackController: new FeedbackController() };
