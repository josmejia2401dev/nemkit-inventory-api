'use strict';

const { RequestContext, RECORD_STATUS, HttpError } = require('nemkit');
const { usersService } = require('../modules/foundation/users/users.service');
const { employeesService } = require('../modules/foundation/employees/employees.service');

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

    // ── EMPLEADO: vive en su propia colección (foundation_employees) ──────
    // El token de empleado lleva employeeId (= su propio id); el de empresa lo
    // trae en null. Resolvemos la empresa (tenant), que debe estar activa. El
    // empleado opera sobre los datos de su empresa.
    if (req.user.employeeId != null) {
      const tenantId = await employeesService.resolveTenantForAccount(realUserId);
      const company = await usersService.findById(tenantId);
      if (!company || company.recordStatus !== RECORD_STATUS.ACTIVE) {
        throw HttpError.forbidden('The associated company account is unavailable');
      }
      req.user.userId = realUserId;      // id real del empleado
      req.user.id = tenantId;            // scoping del dominio por empresa
      req.user.tenantId = tenantId;
      req.user.employeeId = realUserId;  // el empleado ES el responsable
      req.user.businessType = company.businessType ?? 'retail';
      RequestContext.setUserId(realUserId);
      RequestContext.set('tenantId', tenantId);
      return next();
    }

    // ── EMPRESA (dueño de cuenta) ─────────────────────────────────────────
    const account = await usersService.findById(realUserId);
    if (!account || account.recordStatus !== RECORD_STATUS.ACTIVE) {
      throw HttpError.forbidden('This user account is inactive');
    }
    const tenantId = account.tenantId ?? realUserId;

    req.user.userId = realUserId;
    req.user.id = tenantId;
    req.user.tenantId = tenantId;
    req.user.roles = account.roles ?? [];
    req.user.employeeId = null;
    req.user.businessType = account.businessType ?? 'retail';
    RequestContext.setUserId(realUserId);
    RequestContext.set('tenantId', tenantId);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { scopeToTenant };
