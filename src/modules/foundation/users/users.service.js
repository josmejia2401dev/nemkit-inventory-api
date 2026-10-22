'use strict';

const { BaseService, HttpError, hashPassword } = require('nemkit');
const { UsersRepository } = require('./users.repository');

class UsersService extends BaseService {
  constructor() {
    super(new UsersRepository());
    this.notFoundMessage = 'User not found';
  }

  async getById(id) {
    const user = await this.findById(id);
    if (!user) throw HttpError.notFound('User not found');
    return user;
  }

  async create(payload, userId = null) {
    const existing = await this.repository.findByEmail(payload.email);
    if (existing) throw HttpError.conflict('Email already registered');
    const passwordHash = await hashPassword(payload.password);
    return this.repository.create(
      { fullName: payload.fullName, email: payload.email, passwordHash, security: { mustChangePassword: false } },
      userId,
    );
  }

  findByEmail(email) { return this.repository.findByEmail(email); }
  findByIdWithPassword(id) { return this.repository.findByIdWithPassword(id); }
  findByResetToken(token) { return this.repository.findByResetToken(token); }
  updateLoginSecurity(id, data) { return this.repository.updateLoginSecurity(id, data); }

  async changePassword(userId, newPlainPassword) {
    const passwordHash = await hashPassword(newPlainPassword);
    return this.updateById(userId, { passwordHash }, userId);
  }
}

module.exports = { UsersService, usersService: new UsersService() };
