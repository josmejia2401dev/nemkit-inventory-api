'use strict';

const crypto = require('crypto');
const { HttpError, hashPassword, comparePassword, JwtManager } = require('nemkit');
const { env } = require('../../../config/env');
const { usersService } = require('../users/users.service');
const { tokensService } = require('../tokens/tokens.service');
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

class AuthService {

  async register(payload, deviceInfo = {}) {
    const user = await usersService.create(payload);
    const { accessToken, refreshToken } = await this.#createTokens(user, deviceInfo);
    return { user: this.#publicUser(user), company: await this.#company(user), accessToken, refreshToken };
  }

  async login(email, password, deviceInfo = {}) {
    const user = await usersService.findByEmail(email);
    if (!user) throw HttpError.unauthorized('Invalid credentials');
    if (user.recordStatus !== 'active') throw HttpError.forbidden('User inactive');

    if (user.security?.lockedUntil && new Date(user.security.lockedUntil) > new Date()) {
      const min = Math.ceil((new Date(user.security.lockedUntil) - new Date()) / 60000);
      throw new HttpError(429, `Account locked. Try again in ${min} minutes`);
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      const attempts = (user.security?.loginAttempts ?? 0) + 1;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedAt = new Date();
        await usersService.updateLoginSecurity(user.id, {
          'security.loginAttempts': 0,
          'security.lastLockedAt': lockedAt,
          'security.lockedUntil': new Date(lockedAt.getTime() + LOCK_DURATION_MS),
        });
        throw new HttpError(429, `Account locked for 15 minutes`);
      }
      await usersService.updateLoginSecurity(user.id, { 'security.loginAttempts': attempts });
      throw HttpError.unauthorized(`Invalid credentials. ${MAX_LOGIN_ATTEMPTS - attempts} attempts remaining`);
    }

    await usersService.updateLoginSecurity(user.id, { 'security.loginAttempts': 0, 'security.lockedUntil': null, 'security.lastLoginAt': new Date() });
    const { accessToken, refreshToken } = await this.#createTokens(user, deviceInfo);
    return {
      user: this.#publicUser(user),
      company: await this.#company(user),
      accessToken,
      refreshToken,
      mustChangePassword: user.security?.mustChangePassword ?? false,
    };
  }

  async refresh(refreshTokenStr, deviceInfo = {}) {
    let payload;
    try { payload = jwtManager.verifyRefreshToken(refreshTokenStr); }
    catch { throw HttpError.unauthorized('Invalid refresh token'); }

    const oldId = Number(payload.jti);
    const session = await tokensService.validateSession(oldId);
    if (!session) throw HttpError.unauthorized('Session expired or revoked');

    const audience = deviceInfo.audience ?? 'web';
    const result = await tokensService.rotateSession(oldId, payload.id, audience, deviceInfo);
    if (!result) throw HttpError.unauthorized('Session expired or revoked');

    const newJti = String(result.newSession.id);
    const user = await usersService.getById(payload.id);
    const tenantId = user.tenantId ?? user.id;
    const accessToken = jwtManager.signAccessToken({ id: user.id, email: user.email, fullName: user.fullName, roles: user.roles, tenantId, employeeId: user.employeeId ?? null }, newJti);
    const newRefreshToken = jwtManager.signRefreshToken({ id: user.id }, newJti);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId, jti, audience = 'web') {
    await tokensService.revokeByAudience(userId, audience);
    tokensService.blacklistJti(jti, 30 * 60 * 1000);
    return { message: 'Logged out' };
  }

  /**
   * Solicita reset de contraseña. Genera un token y lo guarda con expiración.
   * Responde de forma neutra (no revela si el email existe).
   * En un entorno real, el token se enviaría por email; aquí se retorna para MVP/dev.
   */
  async forgotPassword(email) {
    const user = await usersService.findByEmail(email);
    // Respuesta neutra siempre — no filtrar existencia de cuentas.
    if (!user) return { message: 'If the email exists, a reset link has been sent' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await usersService.updateLoginSecurity(user.id, {
      'security.passwordResetToken': resetToken,
      'security.passwordResetExpires': expires,
    });

    logger.info('Password reset requested', { userId: user.id });

    // MVP/dev: se retorna el token para poder probar el flujo sin email.
    const response = { message: 'If the email exists, a reset link has been sent' };
    if (env.NODE_ENV !== 'production') response.resetToken = resetToken;
    return response;
  }

  /**
   * Restablece la contraseña usando el token de reset.
   */
  async resetPassword(token, newPassword) {
    if (!token || !newPassword) throw HttpError.badRequest('Token and new password are required');
    if (newPassword.length < 6) throw HttpError.badRequest('Password must be at least 6 characters');

    const user = await usersService.findByResetToken(token);
    if (!user) throw HttpError.badRequest('Invalid or expired reset token');

    const expires = user.security?.passwordResetExpires;
    if (!expires || new Date(expires) < new Date()) throw HttpError.badRequest('Invalid or expired reset token');

    await usersService.changePassword(user.id, newPassword);
    await usersService.updateLoginSecurity(user.id, {
      'security.passwordResetToken': null,
      'security.passwordResetExpires': null,
      'security.loginAttempts': 0,
      'security.lockedUntil': null,
    });

    // Revocar todas las sesiones activas por seguridad
    await tokensService.revokeAllSessions(user.id);

    return { message: 'Password reset successful' };
  }

  async #createTokens(user, deviceInfo) {
    const audience = deviceInfo.audience ?? 'web';
    const session = await tokensService.createSession(user.id, audience, deviceInfo);
    const jti = String(session.id);
    const tenantId = user.tenantId ?? user.id;
    const accessToken = jwtManager.signAccessToken({ id: user.id, email: user.email, fullName: user.fullName, roles: user.roles, tenantId, employeeId: user.employeeId ?? null }, jti);
    const refreshToken = jwtManager.signRefreshToken({ id: user.id }, jti);
    return { accessToken, refreshToken };
  }

  #publicUser(user) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles,
      tenantId: user.tenantId ?? user.id,
    };
  }

  /**
   * Resuelve la empresa (tenant) a la que pertenece el usuario para mostrarla
   * tras el login. Para el dueño es su propia cuenta; para un empleado, la del admin.
   */
  async #company(user) {
    const tenantId = user.tenantId ?? user.id;
    const owner = await usersService.findById(tenantId);
    return {
      id: tenantId,
      name: owner?.companyName || owner?.fullName || '',
    };
  }
}

module.exports = { AuthService, authService: new AuthService() };
