'use strict';

const { usersService } = require('../../users/users.service');
const { feedbackService } = require('../../feedback/feedback.service');
const { FEEDBACK_STATUS } = require('../../feedback/feedback.constants');

class PlatformOverviewService {
  async get() {
    const [owners, users, openFeedback, totalFeedback] = await Promise.all([
      usersService.listOwners({ page: 1, limit: 1 }),
      usersService.listGlobal({ page: 1, limit: 1 }),
      feedbackService.countByStatus(FEEDBACK_STATUS.OPEN),
      feedbackService.countAll(),
    ]);

    return {
      companies: owners.pagination?.total ?? 0,
      users: users.pagination?.total ?? 0,
      feedback: { open: openFeedback, total: totalFeedback },
    };
  }
}

module.exports = { PlatformOverviewService, platformOverviewService: new PlatformOverviewService() };
