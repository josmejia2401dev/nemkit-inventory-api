'use strict';

const { MongoRepository, RECORD_STATUS } = require('nemkit');
const Announcement = require('./announcements.model');
const { ANNOUNCEMENT_STATUS } = require('./announcements.constants');

class AnnouncementsRepository extends MongoRepository {
  constructor() {
    super(Announcement);
  }

  startPublishing(id, userId) {
    return this._applyTimeout(this.model.findOneAndUpdate(
      { _id: id, status: ANNOUNCEMENT_STATUS.DRAFT, recordStatus: RECORD_STATUS.ACTIVE },
      { $set: { status: ANNOUNCEMENT_STATUS.PUBLISHING, publishingAt: new Date(), updatedBy: userId } },
      { returnDocument: 'after', lean: true },
    ));
  }

  recoverStalePublishing(id, staleBefore, userId) {
    return this._applyTimeout(this.model.findOneAndUpdate(
      {
        _id: id,
        status: ANNOUNCEMENT_STATUS.PUBLISHING,
        publishingAt: { $lte: staleBefore },
      },
      { $set: { publishingAt: new Date(), updatedBy: userId } },
      { returnDocument: 'after', lean: true },
    ));
  }

  async markPublished(id, recipientCount, userId) {
    return this.model.findOneAndUpdate(
      { _id: id, status: ANNOUNCEMENT_STATUS.PUBLISHING },
      {
        $set: {
          status: ANNOUNCEMENT_STATUS.PUBLISHED,
          publishedAt: new Date(),
          publishingAt: null,
          recipientCount,
          updatedBy: userId,
        },
      },
      { returnDocument: 'after' },
    );
  }

  resetDraft(id, userId) {
    return this._applyTimeout(this.model.updateOne(
      { _id: id, status: ANNOUNCEMENT_STATUS.PUBLISHING },
      { $set: { status: ANNOUNCEMENT_STATUS.DRAFT, publishingAt: null, updatedBy: userId } },
    ));
  }
}

module.exports = { AnnouncementsRepository };
