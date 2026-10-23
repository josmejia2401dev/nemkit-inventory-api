'use strict';

const { RequestContext } = require('nemkit');

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
function scopeToTenant(req, _res, next) {
  const realUserId = req.user.id;
  const tenantId = req.user.tenantId ?? realUserId;
  req.user.userId = realUserId;
  req.user.id = tenantId;
  RequestContext.setUserId(realUserId);
  RequestContext.setTenantId(tenantId);
  next();
}

module.exports = { scopeToTenant };
