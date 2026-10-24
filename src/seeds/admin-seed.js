'use strict';

const { hashPassword, UniqueNumberUtil } = require('nemkit');
const User = require('../modules/foundation/users/users.model');
const logger = require('../config/logger');
const { env } = require('../config/env');
const { ACCOUNT_TYPE } = require('../modules/foundation/users/users.constants');

/**
 * Seed del super administrador de plataforma al arranque.
 *
 * El SUPERADMIN opera la plataforma (ver usuarios, empresas, logs, reportes), no
 * es dueño de una empresa de inventario. Comportamiento idempotente:
 *  - Si la BD no tiene usuarios: crea el SUPERADMIN con las credenciales del
 *    entorno (ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_FULLNAME).
 *  - Si ya existe el usuario de ADMIN_EMAIL pero no tiene el rol SUPERADMIN:
 *    lo promueve (añade SUPERADMIN a sus roles). Así un entorno ya sembrado con
 *    ADMIN queda con super admin sin perder su cuenta.
 */
async function seedAdminUser() {
  const email = String(env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  const fullName = env.ADMIN_FULLNAME;

  const count = await User.countDocuments();

  const legacyPlatformUsers = await User.find({ roles: 'SUPERADMIN', accountType: null })
    .select('_id tenantId employeeId companyName roles')
    .lean();
  for (const user of legacyPlatformUsers) {
    const isCompanyOwner = user.employeeId == null
      && user.tenantId === user._id
      && ((user.roles ?? []).includes('ADMIN') || Boolean(user.companyName));
    await User.updateOne({ _id: user._id, accountType: null }, {
      $set: { accountType: isCompanyOwner ? ACCOUNT_TYPE.COMPANY_OWNER : ACCOUNT_TYPE.SUPERADMIN },
    });
  }
  await User.updateMany(
    { roles: { $nin: ['SUPERADMIN'] }, employeeId: { $ne: null }, accountType: null },
    { $set: { accountType: ACCOUNT_TYPE.EMPLOYEE } },
  );
  await User.updateMany(
    { roles: { $nin: ['SUPERADMIN'] }, employeeId: null, accountType: null, recordStatus: { $ne: 'deleted' } },
    { $set: { accountType: ACCOUNT_TYPE.COMPANY_OWNER } },
  );

  // Caso 1: BD vacía → crear el super admin inicial.
  if (count === 0) {
    // Salvaguarda: nunca sembrar con contraseña ausente o débil/conocida.
    if (!password || password.trim().length < 8 || password === 'admin123') {
      logger.warn('Super admin seed skipped: ADMIN_PASSWORD is missing or too weak (min 8 chars, not "admin123"). Set a strong ADMIN_PASSWORD to seed the super admin.');
      return;
    }

    logger.info('No users found — creating default super admin user...');
    const passwordHash = await hashPassword(password);
    const superAdminId = UniqueNumberUtil.generateRaw();
    await User.create({
      _id: superAdminId,
      // El super admin no tiene empresa propia; su tenant es él mismo por
      // consistencia del esquema, pero no se usa para datos de inventario.
      tenantId: superAdminId,
      fullName,
      email,
      passwordHash,
      roles: ['SUPERADMIN'],
      accountType: ACCOUNT_TYPE.SUPERADMIN,
      security: { mustChangePassword: true },
      recordStatus: 'active',
      createdBy: null,
      updatedBy: null,
    });
    logger.info(`Default super admin created: ${email} (must change password on first login)`);
    return;
  }

  // Caso 2: ya hay usuarios → asegurar que el usuario de ADMIN_EMAIL sea SUPERADMIN.
  if (!email) return;
  const existing = await User.findOne({ email, recordStatus: { $ne: 'deleted' } }).lean();
  if (existing && !(existing.roles ?? []).includes('SUPERADMIN')) {
    const roles = [...new Set([...(existing.roles ?? []), 'SUPERADMIN'])];
    const accountType = existing.accountType
      ?? (existing.employeeId != null
        ? ACCOUNT_TYPE.EMPLOYEE
        : existing.tenantId === existing._id
          ? ACCOUNT_TYPE.COMPANY_OWNER
          : ACCOUNT_TYPE.SUPERADMIN);
    await User.updateOne({ _id: existing._id }, {
      roles,
      accountType,
      updatedBy: existing._id,
    });
    logger.info(`Promoted ${email} to SUPERADMIN.`);
  }
}

module.exports = { seedAdminUser };
