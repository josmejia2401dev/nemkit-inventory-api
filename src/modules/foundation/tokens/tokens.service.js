'use strict';

const { createMemoryCache } = require('nemkit');
const { env } = require('../../../config/env');
const { TokensRepository } = require('./tokens.repository');

const jtiBlacklist = createMemoryCache({ maxSize: 10000, defaultTtlMs: 30 * 60 * 1000, policy: 'LRU' });

class TokensService {
  constructor() { this.repository = new TokensRepository(); }

  /**
   * Crea una sesión. Genera el _id numérico y lo retorna para usar como jti en el JWT.
   * @returns {{ id: number, ... }} — el id ES el jti
   */
  async createSession(userId, audience, deviceInfo = {}) {
    await this.repository.deleteByUserAndAudience(userId, audience);
    const expiresAt = this.#calcExp(env.JWT_REFRESH_EXPIRES_IN);
    const session = await this.repository.create({ userId, audience, deviceInfo, expiresAt });
    return session; // session.id = _id numérico = jti
  }

  /**
   * Valida que la sesión exista y no esté expirada.
   * @param {number} id — el _id del token (= jti del JWT)
   */
  async validateSession(id) {
    return this.repository.findValidById(id);
  }

  /**
   * Rota: elimina la sesión vieja y crea una nueva.
   * @returns {{ oldSession, newSession }} o null si no existe
   */
  async rotateSession(oldId, userId, audience, deviceInfo = {}) {
    const existing = await this.repository.findValidById(oldId);
    if (!existing) return null;
    await this.repository.deleteById(oldId);
    const newSession = await this.createSession(userId, audience, deviceInfo);
    return { oldSession: existing, newSession };
  }

  async revokeAllSessions(userId) { return this.repository.deleteAllByUser(userId); }
  async revokeByAudience(userId, audience) { return this.repository.deleteByUserAndAudience(userId, audience); }

  blacklistJti(jti, ttlMs) { jtiBlacklist.set(String(jti), true, { ttlMs }); }
  isJtiBlacklisted(jti) { return jtiBlacklist.get(String(jti)) === true; }

  #calcExp(expiresIn) {
    const u = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const m = expiresIn.match(/^(\d+)([smhd])$/);
    if (!m) return new Date(Date.now() + 7 * 86400000);
    return new Date(Date.now() + parseInt(m[1]) * u[m[2]]);
  }
}

module.exports = { TokensService, tokensService: new TokensService() };
