'use strict';

const { BaseService, HttpError, RECORD_STATUS } = require('nemkit');
const { TablesRepository } = require('./tables.repository');
const { pagination, positiveInteger, assertNoEmptyUpdate } = require('../validation');
class TablesService extends BaseService {
  constructor() {
    super(new TablesRepository());
    this.notFoundMessage = 'Table not found';
  }

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    return this.filterAndPaginate(filter, { page, limit, sort: { name: 1 } });
  }

  /**
   * Lista de mesas con su estado de ocupación derivado: una mesa está ocupada
   * si tiene al menos una comanda de cocina activa (no servida) a su nombre.
   * No se persiste ocupación; se calcula para evitar desincronización.
   */
  async listWithOccupancy(userId) {
    const tables = await this.repository.listForOccupancy(userId);

    // Mesas con comanda activa (agrupadas por nombre de mesa).
    const { salesService } = require('../sales/sales.service');
    const busy = await salesService.activeKitchenOrderCountsByTable(userId);
    const busyByName = new Map(busy.map((row) => [row._id, row.orders]));

    return tables.map((table) => ({
      id: table._id,
      name: table.name,
      description: table.description || '',
      occupied: busyByName.has(table.name),
      activeOrders: busyByName.get(table.name) || 0,
    }));
  }

  async getOwned(id, userId) {
    const tableId = positiveInteger(id, 'tableId');
    const table = await this.findOne({ _id: tableId, userId, recordStatus: RECORD_STATUS.ACTIVE });
    if (!table) throw HttpError.notFound('Table not found');
    return table;
  }

  async create(data, userId) {
    try {
      return await this.repository.create({ ...data, userId }, userId);
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('A table with that name already exists');
      throw error;
    }
  }

  async update(id, data, userId) {
    const tableId = positiveInteger(id, 'tableId');
    await this.getOwned(tableId, userId);
    assertNoEmptyUpdate(data, ['name', 'description']);
    try {
      return await this.updateById(tableId, data, userId);
    } catch (error) {
      if (error?.code === 11000) throw HttpError.conflict('A table with that name already exists');
      throw error;
    }
  }

  async remove(id, userId) {
    const tableId = positiveInteger(id, 'tableId');
    await this.getOwned(tableId, userId);
    return this.softDelete(tableId, userId);
  }
}

module.exports = { TablesService, tablesService: new TablesService() };
