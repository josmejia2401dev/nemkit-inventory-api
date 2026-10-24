'use strict';

const { success } = require('nemkit');
const { profileService } = require('./profile.service');
const { profileSchema, passwordSchema } = require('./profile.validator');

class ProfileController {
  async get(req, res, next) {
    try {
      return success(res, await profileService.get(req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { errorResponse, sanitized } = profileSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      return success(res, await profileService.update(req.user.id, sanitized), 'Profile updated');
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { errorResponse, sanitized } = passwordSchema.check(req.body ?? {}, req);
      if (errorResponse) return res.status(400).json(errorResponse);
      await profileService.changePassword(req.user.id, sanitized.currentPassword, sanitized.newPassword);
      return success(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { ProfileController, profileController: new ProfileController() };
