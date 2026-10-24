'use strict';

const { RequestContext, RECORD_STATUS, HttpError } = require('nemkit');
const { usersService } = require('../modules/foundation/users/users.service');
const { employeesService } = require('../modules/inventory/employees/employees.service');

/**
 * Middleware de scoping por cuenta/empresa (tenant).
 *
 * A partir de este punto, el dominio de inventario opera sobre la EMPRESA
 * (tenant), no sobre el usuario individual. El administrador dueño y todos sus
 * empleados comparten el mismo silo de datos de su empresa.
 *
 * - `req.user.id` se reescribe al `tenantId` efectivo para que los controladores
 *   de dominio (que filtran por `req.user.id`) queden acotados a la empresa.
 * - `req.user.userId` conserva el id real del usuario autenticado, para auditoría
 *   y operaciones sobre el propio usuario.
 *
 * Debe montarse DESPUÉS de `authenticate` y DESPUÉS de las rutas que operan sobre
 * el propio usuario (p. ej. /profile), y ANTES de las rutas de dominio.
 */
async function scopeToTenant(req, _res, next) {
  try {
    const realUserId = req.user.id;
    const account = await usersService.findById(realUserId);
    if (!account || account.recordStatus !== RECORD_STATUS.ACTIVE) {
      throw HttpError.forbidden('This user account is inactive');
    }

    // The employee association is the authoritative link to the company.
    // Older employee accounts can have their own ID in users.tenantId, so
    // trusting that field would silently show an empty, personal inventory.
    const tenantId = account.employeeId != null
      ? await employeesService.resolveTenantForAccount(realUserId, account.employeeId)
      : account.tenantId ?? realUserId;
    let tenantAccount = account;

    if (account.employeeId != null) {
      tenantAccount = await usersService.findById(tenantId);
      const company = tenantAccount;
      if (!company || company.recordStatus !== RECORD_STATUS.ACTIVE || company.employeeId != null) {
        throw HttpError.forbidden('The associated company account is unavailable');
      }
    }

    req.user.userId = realUserId;
    req.user.id = tenantId;
    req.user.tenantId = tenantId;
    req.user.roles = account.roles ?? [];
    req.user.employeeId = account.employeeId ?? null;
    req.user.businessType = tenantAccount.businessType ?? 'retail';
    RequestContext.setUserId(realUserId);
    RequestContext.set('tenantId', tenantId);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { scopeToTenant };
