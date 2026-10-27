'use strict';

const { success } = require('nemkit');
const { authEmployeeService } = require('./auth-employees.service');
const {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('./auth-employees.validator');

function check(schema, req, res) {
  const result = schema.check(req.body ?? {}, req);
  if (result.errorResponse) {
    res.status(400).json(result.errorResponse);
    return null;
  }
  return result.sanitized;
}

class AuthEmployeeController {
  constructor() { this.service = authEmployeeService; }

  async login(req, res, next) {
    try {
      const payload = check(loginSchema, req, res);
      if (!payload) return;
      const { email, password } = payload;
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
    return { ip: req.ip, userAgent: req.headers['user-agent'] ?? null, audience: req.headers['x-audience'] ?? 'web' };
  }
}

module.exports = { AuthEmployeeController, authEmployeeController: new AuthEmployeeController() };
