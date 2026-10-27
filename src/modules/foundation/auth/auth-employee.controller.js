'use strict';

const { success } = require('nemkit');
const { authEmployeeService } = require('./auth-employee.service');

class AuthEmployeeController {
  constructor() { this.service = authEmployeeService; }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await this.service.login(email, password, this.#device(req));
      return success(res, result, 'Login successful');
    } catch (err) { next(err); }
  }

  async refresh(req, res, next) {
    try {
      const result = await this.service.refresh(req.body.refreshToken, this.#device(req));
      return success(res, result, 'Token refreshed');
    } catch (err) { next(err); }
  }

  async forgotPassword(req, res, next) {
    try {
      const result = await this.service.forgotPassword(req.body.email);
      return success(res, result, 'Request processed');
    } catch (err) { next(err); }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      const result = await this.service.resetPassword(token, newPassword);
      return success(res, result, 'Password reset successful');
    } catch (err) { next(err); }
  }

  #device(req) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] ?? null, audience: req.headers['x-audience'] ?? 'web' };
  }
}

module.exports = { AuthEmployeeController, authEmployeeController: new AuthEmployeeController() };
