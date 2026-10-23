'use strict';

const { BaseService, HttpError, hashPassword, UniqueNumberUtil } = require('nemkit');
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

  /**
   * Registro público: crea el dueño de una cuenta. Su tenant es él mismo,
   * de modo que se convierte en el silo de datos de su propia empresa.
   */
  async create(payload, userId = null) {
    const email = String(payload.email ?? '').trim().toLowerCase();
    if (!email) throw HttpError.badRequest('email is required');
    const existing = await this.repository.findByEmail(email);
    if (existing) throw HttpError.conflict('Email already registered');
    const passwordHash = await hashPassword(payload.password);
    const ownerId = UniqueNumberUtil.generateRaw();
    try {
      return await this.repository.create(
        {
          _id: ownerId,
          tenantId: ownerId,
          fullName: payload.fullName,
          email,
          companyName: payload.companyName ?? '',
          passwordHash,
          roles: ['ADMIN'],
          security: { mustChangePassword: false },
        },
        userId,
      );
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('Email already registered');
      throw error;
    }
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
