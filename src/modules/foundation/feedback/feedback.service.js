'use strict';

const { BaseService, HttpError, UniqueNumberUtil } = require('nemkit');
const { FeedbackRepository } = require('./feedback.repository');
const { FEEDBACK_TYPES, FEEDBACK_STATUSES, FEEDBACK_STATUS } = require('./feedback.constants');

class FeedbackService extends BaseService {
  constructor() {
    super(new FeedbackRepository());
    this.notFoundMessage = 'Feedback not found';
  }

  /**
   * Crea un reporte a nombre del usuario autenticado, guardando un snapshot de
   * quién reportó y desde qué empresa para que el super admin tenga contexto.
   *
   * @param {{title:string, description:string, type?:string}} data
   * @param {{id:number, fullName?:string, email?:string, companyName?:string, tenantId?:number}} user
   */
  async createForUser(data, user) {
    const title = String(data.title ?? '').trim();
    const description = String(data.description ?? '').trim();
    if (title.length < 3 || title.length > 160) {
      throw HttpError.badRequest('title must be between 3 and 160 characters');
    }
    if (description.length < 3 || description.length > 4000) {
      throw HttpError.badRequest('description must be between 3 and 4000 characters');
    }
    const type = FEEDBACK_TYPES.includes(data.type) ? data.type : 'bug';

    return this.create({
      _id: UniqueNumberUtil.generateRaw(),
      userId: user.id,
      tenantId: user.tenantId ?? user.id,
      userSnapshot: {
        fullName: user.fullName ?? '',
        email: user.email ?? '',
        companyName: user.companyName ?? '',
      },
      type,
      title,
      description,
      status: FEEDBACK_STATUS.OPEN,
    }, user.id);
  }

  /**
   * Listado global para el super admin (todas las empresas). Permite filtrar por
   * estado y tipo, y buscar por título.
   */
  async listAll(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const filter = {};
    if (query.status !== undefined) {
      if (!FEEDBACK_STATUSES.includes(query.status)) {
        throw HttpError.badRequest(`status must be one of: ${FEEDBACK_STATUSES.join(', ')}`);
      }
      filter.status = query.status;
    }
    if (query.type !== undefined) {
      if (!FEEDBACK_TYPES.includes(query.type)) {
        throw HttpError.badRequest(`type must be one of: ${FEEDBACK_TYPES.join(', ')}`);
      }
      filter.type = query.type;
    }
    const search = typeof query.search === 'string' && query.search.trim()
      ? { value: query.search.trim(), fields: ['title', 'description'] }
      : null;

    return this.filterAndPaginate(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      search,
    });
  }

  /** Cambia el estado de atención de un reporte (solo super admin). */
  async changeFeedbackStatus(id, status, userId) {
    if (!FEEDBACK_STATUSES.includes(status)) {
      throw HttpError.badRequest(`status must be one of: ${FEEDBACK_STATUSES.join(', ')}`);
    }
    return this.updateById(id, { status }, userId);
  }

  countByStatus(status) {
    if (!FEEDBACK_STATUSES.includes(status)) {
      throw HttpError.badRequest(`status must be one of: ${FEEDBACK_STATUSES.join(', ')}`);
    }
    return this.countDocuments({ status });
  }

  countAll() {
    return this.countDocuments({});
  }
}

module.exports = { FeedbackService, feedbackService: new FeedbackService() };
