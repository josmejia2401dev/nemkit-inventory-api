'use strict';

const { HttpError, hashPassword, comparePassword } = require('nemkit');
const { usersService } = require('../users/users.service');

class ProfileService {
  async get(userId) {
    const user = await usersService.getById(userId);
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles,
      companyName: user.companyName ?? '',
      businessType: user.businessType ?? 'retail',
      security: {
        loginAttempts: user.security?.loginAttempts ?? 0,
        lastLockedAt: user.security?.lastLockedAt ?? null,
        lockedUntil: user.security?.lockedUntil ?? null,
        lastLoginAt: user.security?.lastLoginAt ?? null,
        mustChangePassword: user.security?.mustChangePassword ?? false,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async update(userId, data) {
    try {
      const user = await usersService.updateById(userId, data, userId);
      return { fullName: user.fullName, email: user.email };
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('Email already registered');
      throw error;
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await usersService.findByIdWithPassword(userId);
    if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
      throw HttpError.badRequest('Current password is incorrect');
    }

    const passwordHash = await hashPassword(newPassword);
    await usersService.updateById(userId, { passwordHash }, userId);
  }
}

module.exports = { ProfileService, profileService: new ProfileService() };
