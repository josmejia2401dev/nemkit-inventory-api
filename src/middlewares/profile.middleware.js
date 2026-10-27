'use strict';

const { RequestContext, RECORD_STATUS, HttpError } = require('nemkit');
const { usersService } = require('../modules/foundation/users/users.service');
const { employeesService } = require('../modules/foundation/employees/employees.service');

/**
 * Middlewares de autorización por PERFIL. Cada espacio de la API tiene su propio
 * guardián de entrada (SRP): superadmin, empresa (users) y empleado. Deben ir
 * SIEMPRE después de `authenticate` (que puebla req.user desde el JWT).
 *
 * Señal de perfil (del token):
 * - empleado → `req.user.employeeId != null`
 * - superadmin → roles incluye 'SUPERADMIN'
 * - empresa (dueño) → el resto
 */

/** Scoping de EMPRESA: el dominio opera sobre la propia cuenta (tenant = self). */
async function scopeCompany(req) {
  const realUserId = req.user.id;
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
}

/** Scoping de EMPLEADO: opera sobre los datos de su empresa (tenant resuelto). */
async function scopeEmployee(req) {
  const realUserId = req.user.id;
  const tenantId = await employeesService.resolveTenantForAccount(realUserId);
  const company = await usersService.findById(tenantId);
  if (!company || company.recordStatus !== RECORD_STATUS.ACTIVE) {
    throw HttpError.forbidden('The associated company account is unavailable');
  }
  req.user.userId = realUserId;     // id real del empleado
  req.user.id = tenantId;           // scoping del dominio por empresa
  req.user.tenantId = tenantId;
  req.user.employeeId = realUserId; // el empleado ES el responsable
  req.user.businessType = company.businessType ?? 'retail';
  RequestContext.setUserId(realUserId);
  RequestContext.set('tenantId', tenantId);
}

/** Espacio /sys: exclusivo del super administrador (global, sin tenant). */
function requireSuperAdmin(req, _res, next) {
  const roles = req.user?.roles ?? [];
  if (!roles.includes('SUPERADMIN')) {
    return next(HttpError.forbidden('Super admin access required'));
  }
  RequestContext.setUserId(req.user.id);
  next();
}

/** Espacio /users: exclusivo de empresas (dueños). Rechaza empleados y superadmin. */
async function requireCompany(req, _res, next) {
  try {
    if (req.user?.employeeId != null) {
      return next(HttpError.forbidden('This space is for company accounts'));
    }
    if ((req.user?.roles ?? []).includes('SUPERADMIN')) {
      return next(HttpError.forbidden('This space is for company accounts'));
    }
    await scopeCompany(req);
    next();
  } catch (error) {
    next(error);
  }
}

/** Espacio /employees: exclusivo de empleados (token con employeeId). */
async function requireEmployee(req, _res, next) {
  try {
    if (req.user?.employeeId == null) {
      return next(HttpError.forbidden('This space is for employee accounts'));
    }
    await scopeEmployee(req);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Dominio operativo compartido (inventario). Lo usan EMPRESA y EMPLEADO; nunca
 * el superadmin. Resuelve el scoping según el perfil del token.
 */
async function scopeToTenant(req, _res, next) {
  try {
    if ((req.user?.roles ?? []).includes('SUPERADMIN') && req.user?.employeeId == null) {
      return next(HttpError.forbidden('Super admin has no operational tenant'));
    }
    if (req.user?.employeeId != null) {
      await scopeEmployee(req);
    } else {
      await scopeCompany(req);
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireSuperAdmin, requireCompany, requireEmployee, scopeToTenant };
