'use strict';

const { success } = require('nemkit');
const { authService } = require('./auth-users.service');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('./auth-users.validator');

function check(schema, req, res) {
  const result = schema.check(req.body ?? {}, req);
  if (result.errorResponse) {
    res.status(400).json(result.errorResponse);
    return null;
  }
  return result.sanitized;
}

class AuthController {
  constructor() { this.service = authService; }

  async register(req, res, next) {
    try {
      const payload = check(registerSchema, req, res);
      if (!payload) return;
      const result = await this.service.register(payload, this.#device(req));
      return success(res, result, 'Registration successful', 201);
    } catch (err) { next(err); }
  }

  async login(req, res, next) {
    try {
      const { email, password } = check(loginSchema, req, res) ?? {};
      if (!email || !password) return;
      const result = await this.service.login(email, password, this.#device(req));
      return success(res, result, 'Login successful');
    } catch (err) { next(err); }
  }

  async refresh(req, res, next) {
    try {
      const payload = check(refreshSchema, req, res);
      if (!payload) return;
      const result = await this.service.refresh(payload.refreshToken, this.#device(req));
      return success(res, result, 'Token refreshed');
    } catch (err) { next(err); }
  }

  async logout(req, res, next) {
    try {
      const audience = req.headers['x-audience'] ?? 'web';
      const result = await this.service.logout(req.user.id, req.user.jti, audience);
      return success(res, result, 'Logged out');
    } catch (err) { next(err); }
  }

  async forgotPassword(req, res, next) {
    try {
      const payload = check(forgotPasswordSchema, req, res);
      if (!payload) return;
      const result = await this.service.forgotPassword(payload.email);
      return success(res, result, 'Request processed');
    } catch (err) { next(err); }
  }

  async resetPassword(req, res, next) {
    try {
      const payload = check(resetPasswordSchema, req, res);
      if (!payload) return;
      const { token, newPassword } = payload;
      const result = await this.service.resetPassword(token, newPassword);
      return success(res, result, 'Password reset successful');
    } catch (err) { next(err); }
  }

  #device(req) {
    return {
      ip: typeof req.ip === 'string' ? req.ip.slice(0, 45) : null,
      userAgent: typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent'].slice(0, 512)
        : null,
      audience: req.headers['x-audience'] ?? 'web',
    };
  }
}

module.exports = { AuthController, authController: new AuthController() };
