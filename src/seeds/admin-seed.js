'use strict';

const { hashPassword, UniqueNumberUtil } = require('nemkit');
const User = require('../modules/foundation/users/users.model');
const logger = require('../config/logger');
const { env } = require('../config/env');

/**
 * Seed de usuario admin al primer arranque.
 * Si no hay usuarios en la BD, crea un admin usando las credenciales del
 * entorno (ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_FULLNAME).
 */
async function seedAdminUser() {
  const count = await User.countDocuments();
  if (count > 0) return;

  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;
  const fullName = env.ADMIN_FULLNAME;

  // Salvaguarda: nunca sembrar un admin con contraseña ausente o débil/conocida.
  if (!password || password.trim().length < 8 || password === 'admin123') {
    logger.warn('Admin seed skipped: ADMIN_PASSWORD is missing or too weak (min 8 chars, not "admin123"). Set a strong ADMIN_PASSWORD to seed the admin.');
    return;
  }

  logger.info('No users found — creating default admin user...');

  const passwordHash = await hashPassword(password);

  await User.create({
    _id: UniqueNumberUtil.generateRaw(),
    fullName,
    email,
    passwordHash,
    roles: ['ADMIN'],
    security: { mustChangePassword: true },
    recordStatus: 'active',
    createdBy: null,
    updatedBy: null,
  });

  logger.info(`Default admin created: ${email} (must change password on first login)`);
}

module.exports = { seedAdminUser };
