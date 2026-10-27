'use strict';

const crypto = require('crypto');
const { HttpError, comparePassword, JwtManager } = require('nemkit');
const { env } = require('../../../config/env');
const { employeesService } = require('../employees/employees.service');
const { usersService } = require('../users/users.service');
const { tokensService } = require('../tokens/tokens.service');
const { EMPLOYEE_ROLE_TO_USER_ROLES, EMPLOYEE_STATUS } = require('../employees/employees.constants');
const logger = require('../../../config/logger');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const jwtManager = new JwtManager({
  accessSecret: env.JWT_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: env.JWT_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
});

/**
 * Autenticación de EMPLEADOS (colección propia, separada de las empresas).
 * El token marca `type: 'employee'` y lleva el `tenantId` de la empresa, de modo
 * que el empleado opera sobre los datos de su empresa igual que antes.
 */
class AuthEmployeeService {
  async login(email, password, deviceInfo = {}) {
    const normalized = String(email ?? '').trim().toLowerCase();
    const employee = await employeesService.findByEmailWithPassword(normalized);
    if (!employee) throw HttpError.unauthorized('Invalid credentials');
    if (employee.recordStatus !== 'active' || employee.status !== EMPLOYEE_STATUS.ACTIVE) {
      throw HttpError.forbidden('Employee account inactive');
    }

    if (employee.security?.lockedUntil && new Date(employee.security.lockedUntil) > new Date()) {
      const min = Math.ceil((new Date(employee.security.lockedUntil) - new Date()) / 60000);
      throw new HttpError(429, `Account locked. Try again in ${min} minutes`);
    }

    const valid = await comparePassword(password, employee.passwordHash);
    if (!valid) {
      const attempts = (employee.security?.loginAttempts ?? 0) + 1;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedAt = new Date();
        await employeesService.updateLoginSecurity(employee.id, {
          'security.loginAttempts': 0,
          'security.lastLockedAt': lockedAt,
          'security.lockedUntil': new Date(lockedAt.getTime() + LOCK_DURATION_MS),
        });
        throw new HttpError(429, 'Account locked for 15 minutes');
      }
      await employeesService.updateLoginSecurity(employee.id, { 'security.loginAttempts': attempts });
      throw HttpError.unauthorized(`Invalid credentials. ${MAX_LOGIN_ATTEMPTS - attempts} attempts remaining`);
    }

    await employeesService.updateLoginSecurity(employee.id, {
      'security.loginAttempts': 0,
      'security.lockedUntil': null,
      'security.lastLoginAt': new Date(),
    });

    const { accessToken, refreshToken } = await this.#createTokens(employee, deviceInfo);
    return {
      user: this.#publicEmployee(employee),
      company: await this.#company(employee.tenantId),
      accessToken,
      refreshToken,
      mustChangePassword: employee.security?.mustChangePassword ?? false,
    };
  }

  async refresh(refreshTokenStr, deviceInfo = {}) {
    let payload;
    try { payload = jwtManager.verifyRefreshToken(refreshTokenStr); }
    catch { throw HttpError.unauthorized('Invalid refresh token'); }

    const oldId = Number(payload.jti);
    const existing = await tokensService.validateSession(oldId);
    if (!existing) throw HttpError.unauthorized('Session expired or revoked');

    const employee = await employeesService.findByIdWithPassword(payload.id);
    if (!employee || employee.recordStatus !== 'active' || employee.status !== EMPLOYEE_STATUS.ACTIVE) {
      throw HttpError.forbidden('Employee account inactive');
    }

    const audience = deviceInfo.audience ?? 'web';
    const result = await tokensService.rotateSession(oldId, payload.id, audience, deviceInfo);
    if (!result) throw HttpError.unauthorized('Session expired or revoked');

    const newJti = String(result.newSession.id);
    const accessToken = this.#signAccess(employee, newJti);
    const newRefreshToken = jwtManager.signRefreshToken({ id: employee.id, type: 'employee' }, newJti);
    return { accessToken, refreshToken: newRefreshToken };
  }

  async forgotPassword(email) {
    const employee = await employeesService.findByEmailWithPassword(String(email ?? '').trim().toLowerCase());
    if (!employee) return { message: 'If the email exists, a reset link has been sent' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await employeesService.updateLoginSecurity(employee.id, {
      'security.passwordResetToken': resetToken,
      'security.passwordResetExpires': expires,
    });
    logger.info('Employee password reset requested', { employeeId: employee.id });

    const response = { message: 'If the email exists, a reset link has been sent' };
    if (env.NODE_ENV !== 'production') response.resetToken = resetToken;
    return response;
  }

  async resetPassword(token, newPassword) {
    if (!token || !newPassword) throw HttpError.badRequest('Token and new password are required');
    if (newPassword.length < 6) throw HttpError.badRequest('Password must be at least 6 characters');

    const employee = await employeesService.findByResetToken(token);
    if (!employee) throw HttpError.badRequest('Invalid or expired reset token');
    const expires = employee.security?.passwordResetExpires;
    if (!expires || new Date(expires) < new Date()) throw HttpError.badRequest('Invalid or expired reset token');

    await employeesService.changePassword(employee.id, newPassword);
    await employeesService.updateLoginSecurity(employee.id, {
      'security.passwordResetToken': null,
      'security.passwordResetExpires': null,
      'security.loginAttempts': 0,
      'security.lockedUntil': null,
    });
    await tokensService.revokeAllSessions(employee.id);
    return { message: 'Password reset successful' };
  }

  async #createTokens(employee, deviceInfo) {
    const audience = deviceInfo.audience ?? 'web';
    const session = await tokensService.createSession(employee.id, audience, deviceInfo);
    const jti = String(session.id);
    const accessToken = this.#signAccess(employee, jti);
    const refreshToken = jwtManager.signRefreshToken({ id: employee.id, type: 'employee' }, jti);
    return { accessToken, refreshToken };
  }

  #signAccess(employee, jti) {
    const roles = EMPLOYEE_ROLE_TO_USER_ROLES[employee.role] ?? [];
    return jwtManager.signAccessToken({
      id: employee.id,
      type: 'employee',
      email: employee.email,
      fullName: employee.name,
      roles,
      tenantId: employee.tenantId,
      employeeId: employee.id,
    }, jti);
  }

  #publicEmployee(employee) {
    return {
      id: employee.id,
      fullName: employee.name,
      email: employee.email,
      roles: EMPLOYEE_ROLE_TO_USER_ROLES[employee.role] ?? [],
      tenantId: employee.tenantId,
      employeeId: employee.id,
      role: employee.role,
    };
  }

  async #company(tenantId) {
    const owner = await usersService.findById(tenantId);
    return {
      id: tenantId,
      name: owner?.companyName || owner?.fullName || '',
      businessType: owner?.businessType ?? 'retail',
    };
  }
}

module.exports = { AuthEmployeeService, authEmployeeService: new AuthEmployeeService() };
