'use strict';

const { HttpError } = require('nemkit');
const { usersService } = require('../users/users.service');
const Feedback = require('../feedback/feedback.model');

/**
 * Servicio de administración de PLATAFORMA (uso exclusivo del super admin).
 *
 * Opera de forma GLOBAL (sin acotar por tenant). En este modelo la "empresa" es
 * el usuario dueño de la cuenta (tenantId === _id, sin employeeId); sus empleados
 * son usuarios de login con el mismo tenantId y employeeId no nulo.
 */
class PlatformService {
  /** Proyección pública de un usuario (nunca expone el hash de contraseña). */
  #publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles ?? [],
      tenantId: user.tenantId ?? null,
      companyName: user.companyName ?? '',
      businessType: user.businessType ?? 'retail',
      employeeId: user.employeeId ?? null,
      isOwner: user.employeeId == null,
      recordStatus: user.recordStatus,
      security: {
        lastLoginAt: user.security?.lastLoginAt ?? null,
        lockedUntil: user.security?.lockedUntil ?? null,
        mustChangePassword: user.security?.mustChangePassword ?? false,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  #pageOptions(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const search = typeof query.search === 'string' && query.search.trim() ? query.search.trim() : null;
    return { page, limit, search };
  }

  /** Resumen de plataforma: conteos de empresas, usuarios y reportes. */
  async overview() {
    const [owners, users, openFeedback, totalFeedback] = await Promise.all([
      usersService.listOwners({ page: 1, limit: 1 }),
      usersService.listGlobal({ page: 1, limit: 1 }),
      Feedback.countDocuments({ status: 'open', recordStatus: { $ne: 'deleted' } }),
      Feedback.countDocuments({ recordStatus: { $ne: 'deleted' } }),
    ]);
    return {
      companies: owners.pagination?.total ?? 0,
      users: users.pagination?.total ?? 0,
      feedback: { open: openFeedback, total: totalFeedback },
    };
  }

  /** Listado global de usuarios con filtros (rol, tipo) y búsqueda. */
  async listUsers(query = {}) {
    const { page, limit, search } = this.#pageOptions(query);
    const role = typeof query.role === 'string' && query.role.trim() ? query.role.trim().toUpperCase() : null;
    const kind = ['owner', 'employee'].includes(query.kind) ? query.kind : null;
    const result = await usersService.listGlobal({ page, limit, search, role, kind });
    return { data: result.data.map((u) => this.#publicUser(u)), pagination: result.pagination };
  }

  /** Detalle de un usuario. Si es dueño, incluye a sus empleados. */
  async getUser(id) {
    const user = await usersService.getById(id);
    const result = this.#publicUser(user);
    if (result.isOwner) {
      const employees = await usersService.listEmployeesOfTenant(user.id);
      result.employees = employees.map((e) => this.#publicUser(e));
    }
    return result;
  }

  /** Listado global de empresas (los usuarios dueños de cuenta). */
  async listCompanies(query = {}) {
    const { page, limit, search } = this.#pageOptions(query);
    const result = await usersService.listOwners({ page, limit, search });
    const data = await Promise.all(result.data.map(async (owner) => {
      const userCount = await usersService.countByTenant(owner.id);
      return {
        id: owner.id,
        companyName: owner.companyName || owner.fullName,
        businessType: owner.businessType ?? 'retail',
        ownerName: owner.fullName,
        ownerEmail: owner.email,
        recordStatus: owner.recordStatus,
        createdAt: owner.createdAt,
        memberCount: userCount, // dueño + empleados
      };
    }));
    return { data, pagination: result.pagination };
  }

  /** Detalle de una empresa: el dueño y la lista de sus empleados. */
  async getCompany(id) {
    const owner = await usersService.getById(id);
    if (owner.employeeId != null) {
      // El id corresponde a un empleado, no a una empresa/dueño.
      throw HttpError.badRequest('The given id does not belong to a company owner');
    }
    const employees = await usersService.listEmployeesOfTenant(owner.id);
    return {
      id: owner.id,
      companyName: owner.companyName || owner.fullName,
      businessType: owner.businessType ?? 'retail',
      owner: this.#publicUser(owner),
      employees: employees.map((e) => this.#publicUser(e)),
      memberCount: employees.length + 1,
    };
  }
}

module.exports = { PlatformService, platformService: new PlatformService() };
