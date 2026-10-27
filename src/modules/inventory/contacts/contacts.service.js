'use strict';

const { BaseService, HttpError, RECORD_STATUS } = require('nemkit');
const { pagination, positiveInteger, escapeRegex, assertNoEmptyUpdate } = require('../validation');

class ContactService extends BaseService {
  constructor(repository, hasLinkedRecords, label) {
    super(repository);
    this.hasLinkedRecords = hasLinkedRecords;
    this.label = label;
  }

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    if (query.search !== undefined) {
      if (typeof query.search !== 'string' || query.search.length > 100) {
        throw HttpError.badRequest('search must be a string of at most 100 characters');
      }
      if (query.search.trim()) {
        const value = escapeRegex(query.search.trim());
        return this.filterAndPaginate(filter, {
          page,
          limit,
          search: { value, fields: ['name', 'document', 'email', 'phone'] },
          sort: { name: 1 },
        });
      }
    }
    return this.filterAndPaginate(filter, { page, limit, sort: { name: 1 } });
  }

  async getOwned(id, userId) {
    const contactId = positiveInteger(id, `${this.label}Id`);
    const contact = await this.findOne({
      _id: contactId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });
    if (!contact) throw HttpError.notFound(`${this.label} not found`);
    return contact;
  }

  async create(data, userId) {
    this.#validateEmail(data.email);
    try {
      return await this.repository.create({ ...data, userId }, userId);
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict(`${this.label} document already exists`);
      throw error;
    }
  }

  async update(id, data, userId, fields) {
    const contactId = positiveInteger(id, `${this.label}Id`);
    await this.getOwned(contactId, userId);
    assertNoEmptyUpdate(data, fields);
    this.#validateEmail(data.email);
    try {
      return await this.updateById(contactId, data, userId);
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict(`${this.label} document already exists`);
      throw error;
    }
  }

  async remove(id, userId) {
    const contactId = positiveInteger(id, `${this.label}Id`);
    await this.getOwned(contactId, userId);
    const linked = await this.hasLinkedRecords(userId, contactId);
    if (linked) {
      throw HttpError.conflict(`${this.label} has linked documents and cannot be deleted`);
    }
    return this.softDelete(contactId, userId);
  }

  #validateEmail(email) {
    if (email !== undefined && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw HttpError.badRequest('email must be a valid email address');
    }
  }
}

module.exports = { ContactService };
