'use strict';

const { HttpError, RECORD_STATUS, UniqueNumberUtil } = require('nemkit');
const { employeesService } = require('../../foundation/employees/employees.service');
const { productsService } = require('../products/products.service');
const { movementsService } = require('../movements/movements.service');
const { deliveriesService } = require('../deliveries/deliveries.service');
const { InventoryDocumentService } = require('../documents/document.service');
const { SalesRepository } = require('./sales.repository');
const { customersService } = require('../customers/customers.service');
const { positiveInteger } = require('../validation');
const {
  PRODUCT_TYPE,
  MOVEMENT_TYPE,
  MOVEMENT_DIRECTION,
  DOCUMENT_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  CANCEL_REASONS,
  DELIVERY_STATUS,
} = require('../inventory.constants');

class SalesService extends InventoryDocumentService {
  constructor() {
    super({
      repository: new SalesRepository(),
      contactService: customersService,
      contactField: 'customerId',
      movementType: MOVEMENT_TYPE.SALE,
      direction: MOVEMENT_DIRECTION.OUT,
      amountField: 'unitPrice',
      label: 'Sale',
      requiredContact: true,
    });
  }

  async list(userId, query = {}) {
    const result = await super.list(userId, query);
    const normalizeStatus = (status) => status === 'served'
      ? ORDER_STATUS.DELIVERED
      : status === 'picked_up'
        ? ORDER_STATUS.ON_ROUTE
        : status;
    const normalizedSales = result.data.map((sale) => ({
      ...sale,
      orderStatus: normalizeStatus(sale.orderStatus),
    }));
    const saleIds = normalizedSales.map((sale) => sale._id ?? sale.id).filter(Number.isFinite);
    if (!saleIds.length) return { ...result, data: normalizedSales };

    const deliveries = await deliveriesService.summariesBySaleIds(userId, saleIds);
    const deliveryBySaleId = new Map(deliveries.map((delivery) => [delivery.saleId, delivery]));

    return {
      ...result,
      data: normalizedSales.map((sale) => {
        const delivery = deliveryBySaleId.get(sale._id ?? sale.id);
        return delivery
          ? {
            ...sale,
            deliveryStatus: normalizeStatus(delivery.status),
            deliveryCourierName: delivery.courierSnapshot?.name ?? '',
          }
          : sale;
      }),
    };
  }

  /**
   * Si la venta es a domicilio (data.delivery presente), crea el pedido de
   * entrega vinculado a la venta dentro de la misma transacción. La venta ya
   * descontó el stock; el domicilio es logística de entrega (no vuelve a tocar
   * existencias ni genera otra venta).
   */
  async afterCreate({ document, data, contact, items, userId, session }) {
    if (document.paymentStatus === PAYMENT_STATUS.PAID && contact) {
      await customersService.recordSale(contact, document.total, document.date, userId, session);
    }

    const delivery = data.delivery;
    if (!delivery) return;

    const address = typeof delivery.address === 'string' ? delivery.address.trim() : '';
    if (!address || address.length > 300) {
      throw HttpError.badRequest('delivery.address is required and must be at most 300 characters');
    }

    const location = this.#validateDeliveryLocation(delivery.location);
    const courier = await this.#resolveCourier(userId, delivery.courierId, session);

    await deliveriesService.createFromSale({
      _id: UniqueNumberUtil.generateRaw(),
      userId,
      saleId: document._id,
      // Restaurante: la venta nace con kitchenStatus → el pedido pasa por cocina.
      fromKitchen: data.kitchenStatus != null,
      customerId: document.customerId,
      customerSnapshot: {
        name: contact.name,
        phone: contact.phone || '',
      },
      address,
      location,
      items: items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      total: document.total,
      notes: typeof delivery.notes === 'string' ? delivery.notes.slice(0, 1000) : '',
      status: DELIVERY_STATUS.PENDING,
      courierId: courier.courierId,
      courierSnapshot: courier.courierSnapshot,
      createdBy: userId,
      updatedBy: userId,
    }, session);
  }

  #validateDeliveryLocation(location) {
    if (location == null) return { lat: null, lng: null };
    if (typeof location !== 'object' || Array.isArray(location)) {
      throw HttpError.badRequest('delivery.location must be an object');
    }
    const coord = (value, field, bound) => {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < -bound || value > bound) {
        throw HttpError.badRequest(`delivery.location.${field} must be a number between ${-bound} and ${bound}`);
      }
      return value;
    };
    return { lat: coord(location.lat, 'lat', 90), lng: coord(location.lng, 'lng', 180) };
  }

  async #resolveCourier(userId, courierId, session) {
    if (courierId == null || courierId === '') return { courierId: null, courierSnapshot: { name: '' } };
    const id = positiveInteger(courierId, 'delivery.courierId');
    try {
      return await employeesService.getActiveCourierSnapshot(userId, id, session);
    } catch (error) {
      if (error.statusCode === 400 && error.message.startsWith('Invalid or inactive courier')) {
        throw HttpError.badRequest('Invalid or inactive courier');
      }
      throw error;
    }
  }

  /**
   * Anula una venta: repone el stock, registra un movimiento de reversa,
   * marca la venta como anulada y revierte las métricas del cliente. Todo en
   * una transacción. Idempotente frente a ventas ya anuladas.
   *
   * @param {number} saleId
   * @param {number} userId - empresa
   * @param {Object} [options]
   * @param {string} [options.reason]     - código de motivo (CANCEL_REASON)
   * @param {string} [options.note]       - nota libre opcional (p. ej. para 'other')
   */
  async voidSale(saleId, userId, { reason = '', note = '', actorId = null, actorName = '' } = {}) {
    const id = positiveInteger(saleId, 'saleId');
    const reasonCode = CANCEL_REASONS.includes(reason) ? reason : '';
    const voidNote = typeof note === 'string' ? note.trim().slice(0, 300) : '';

    return this.repository.withTransaction(async (session) => {
      const sale = await this.repository.findOwnedInSession(id, userId, session);
      if (!sale) throw HttpError.notFound('Sale not found');
      if (sale.status === DOCUMENT_STATUS.VOID) {
        throw HttpError.conflict('Sale is already void');
      }

      // Reponer stock EXPANDIENDO recetas, igual que se descontó en la venta:
      // un plato (prepared) no repone stock propio, repone el de sus insumos.
      const soldIds = [...new Set(sale.items.map((item) => item.productId))];
      const soldProducts = await productsService.findSaleReversalDetails(userId, soldIds, session);
      const soldById = new Map(soldProducts.map((p) => [p._id, p]));

      // Consumo físico real a reponer (insumos para platos, el producto para simples).
      const restock = new Map();
      for (const item of sale.items) {
        const product = soldById.get(item.productId);
        if (product && product.type === PRODUCT_TYPE.PREPARED) {
          for (const ri of product.recipe ?? []) {
            restock.set(ri.ingredientId, (restock.get(ri.ingredientId) || 0) + ri.quantity * item.quantity);
          }
        } else {
          restock.set(item.productId, (restock.get(item.productId) || 0) + item.quantity);
        }
      }

      for (const [productId, qty] of restock) {
        await productsService.restoreStock(userId, productId, qty, session);
      }

      // Movimiento de reversa (entrada) con el consumo físico real (insumos expandidos).
      const ingredientById = new Map(soldProducts.map((p) => [p._id, p]));
      const missingIds = [...restock.keys()].filter((pid) => !ingredientById.has(pid));
      if (missingIds.length) {
        const extra = await productsService.findSaleReversalDetails(userId, missingIds, session);
        for (const p of extra) ingredientById.set(p._id, p);
      }
      // Movimiento de reversa solo si hubo stock que reponer. Una venta de solo
      // platos sin receta no descontó nada, así que tampoco genera reversa.
      let voidMovementId = null;
      if (restock.size > 0) {
        voidMovementId = UniqueNumberUtil.generateRaw();
        await movementsService.recordDocumentMovement({
          _id: voidMovementId,
          userId,
          date: new Date(),
          type: MOVEMENT_TYPE.SALE_VOID,
          notes: reasonCode || voidNote ? `Anulación venta #${id}: ${[reasonCode, voidNote].filter(Boolean).join(' - ')}` : `Anulación venta #${id}`,
          employeeId: sale.employeeId ?? null,
          employeeSnapshot: sale.employeeSnapshot ?? { name: '' },
          sourceType: null,
          sourceId: id,
          items: [...restock.entries()].map(([productId, qty]) => ({
            productId,
            quantity: qty,
            direction: MOVEMENT_DIRECTION.IN,
            unitCost: ingredientById.get(productId)?.purchasePrice ?? 0,
          })),
          createdBy: userId,
          updatedBy: userId,
        }, session);
      }

      // Marcar la venta como anulada, guardando el motivo de cancelación.
      await this.repository.updateOwnedInSession(
        id,
        userId,
        { $set: {
          status: DOCUMENT_STATUS.VOID,
          orderStatus: ORDER_STATUS.CANCELLED,
          voidReason: reasonCode,
          voidNote,
          voidedAt: new Date(),
          voidedBy: actorId,
          voidedBySnapshot: { name: typeof actorName === 'string' ? actorName.trim().slice(0, 160) : '' },
          updatedBy: userId,
        } },
        session,
      );

      await deliveriesService.cancelBySale(id, userId, session);

      // Revertir métricas de fidelización solo si la venta llegó a cobrarse
      // (una venta "por cobrar" nunca sumó al cliente).
      if (sale.paymentStatus === PAYMENT_STATUS.PAID) {
        await customersService.reverseSale(sale.customerId, sale.total, userId, session);
      }

      return { id, status: DOCUMENT_STATUS.VOID, voidMovementId };
    });
  }

  hasCustomerSales(userId, customerId) {
    return this.repository.hasCustomerSales(userId, customerId);
  }

  async listCustomerHistory(userId, customerId, { page, limit }) {
    const { sales, total } = await this.repository.listCustomerHistory({
      userId,
      customerId,
      recordStatus: RECORD_STATUS.ACTIVE,
      status: { $ne: DOCUMENT_STATUS.VOID },
    }, { page, limit });

    return {
      sales: sales.map(({ _id, ...sale }) => ({ id: _id, ...sale })),
      total,
    };
  }

  customerAnalytics(userId, customerId) {
    return this.repository.customerAnalytics(userId, customerId);
  }

  activeKitchenOrderCountsByTable(userId) {
    return this.repository.activeKitchenOrderCountsByTable(userId);
  }

  async dashboardEmployeeSales(userId, since) {
    const rows = await this.repository.dashboardEmployeeSales(userId, since);
    return rows.map((row) => ({
      employeeId: row.employeeId,
      employeeName: row.employeeName || `Empleado #${row.employeeId}`,
      salesCount: row.salesCount,
      revenue: this.#roundMoney(row.revenue),
    }));
  }

  async reportSales(userId, range, groupBy, employeeId = null) {
    const match = {
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      status: { $ne: DOCUMENT_STATUS.VOID },
      paymentStatus: PAYMENT_STATUS.PAID,
      date: { $gte: range.from, $lt: range.toExclusive },
    };
    if (employeeId !== null) match.employeeId = employeeId;

    const result = await this.repository.reportSales(match, groupBy);
    return {
      groupBy,
      employeeId: match.employeeId ?? null,
      totals: result[0]?.totals[0] || { salesCount: 0, unitsSold: 0, revenue: 0, grossProfit: 0 },
      periods: result[0]?.periods || [],
    };
  }

  async reportSalesByEmployee(userId, range) {
    const [rows, collectionRows] = await Promise.all([
      this.repository.reportSalesByEmployee({
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
        status: { $ne: DOCUMENT_STATUS.VOID },
        date: { $gte: range.from, $lt: range.toExclusive },
      }),
      this.repository.reportCollectionsByEmployee(userId, range.from, range.toExclusive),
    ]);
    const collectionsByEmployee = new Map(collectionRows.map((row) => [row.employeeId, row]));
    const employees = rows.map((row) => {
      const collections = collectionsByEmployee.get(row.employeeId);
      return {
        employeeId: row.employeeId ?? null,
        employeeName: row.employeeName || (row.employeeId ? `Empleado #${row.employeeId}` : 'Sin asignar'),
        salesCount: row.salesCount,
        unitsSold: row.unitsSold,
        revenue: this.#roundMoney(row.revenue),
        collectedValue: this.#roundMoney(row.collectedValue),
        pendingValue: this.#roundMoney(row.pendingValue),
        collectedInPeriod: this.#roundMoney(collections?.collectedInPeriod ?? 0),
        collectionsCount: collections?.collectionsCount ?? 0,
        grossProfit: this.#roundMoney(row.grossProfit),
      };
    });
    const employeeIds = new Set(employees.map((row) => row.employeeId));
    for (const row of collectionRows) {
      if (employeeIds.has(row.employeeId)) continue;
      employees.push({
        employeeId: row.employeeId ?? null,
        employeeName: row.employeeName || (row.employeeId ? `Empleado #${row.employeeId}` : 'Sin asignar'),
        salesCount: 0,
        unitsSold: 0,
        revenue: 0,
        collectedValue: 0,
        pendingValue: 0,
        collectedInPeriod: this.#roundMoney(row.collectedInPeriod),
        collectionsCount: row.collectionsCount,
        grossProfit: 0,
      });
    }

    return {
      generatedAt: new Date(),
      totals: {
        employeeCount: employees.filter((employee) => employee.employeeId != null).length,
        salesCount: employees.reduce((sum, employee) => sum + employee.salesCount, 0),
        unitsSold: employees.reduce((sum, employee) => sum + employee.unitsSold, 0),
        revenue: this.#roundMoney(employees.reduce((sum, employee) => sum + employee.revenue, 0)),
        collectedValue: this.#roundMoney(employees.reduce((sum, employee) => sum + employee.collectedValue, 0)),
        pendingValue: this.#roundMoney(employees.reduce((sum, employee) => sum + employee.pendingValue, 0)),
        collectedInPeriod: this.#roundMoney(collectionRows.reduce((sum, employee) => sum + employee.collectedInPeriod, 0)),
        collectionsCount: collectionRows.reduce((sum, employee) => sum + employee.collectionsCount, 0),
        grossProfit: this.#roundMoney(employees.reduce((sum, employee) => sum + employee.grossProfit, 0)),
      },
      employees,
    };
  }

  async reportCancelledSales(userId, range, { page = 1, limit = 10 } = {}) {
    const result = await this.repository.reportCancelledSales({
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      status: DOCUMENT_STATUS.VOID,
      voidedAt: { $gte: range.from, $lt: range.toExclusive },
    }, { page, limit });

    return {
      generatedAt: new Date(),
      totals: {
        cancellationCount: result.totals?.cancellationCount ?? 0,
        cancelledValue: this.#roundMoney(result.totals?.cancelledValue ?? 0),
      },
      cancellations: result.cancellations.map(({ _id, ...sale }) => ({ id: _id, ...sale })),
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    };
  }

  #roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /** Lista comandas activas del agregado de ventas. */
  listKitchenOrders(userId, { includeCompleted = false } = {}) {
    return this.repository.listKitchenOrders(userId, includeCompleted);
  }

  async getKitchenSale(saleId, userId) {
    const id = positiveInteger(saleId, 'saleId');
    const sale = await this.repository.findKitchenSale(id, userId);
    if (!sale) throw HttpError.notFound('Sale not found');
    return sale;
  }

  async advanceOrder(saleId, userId, nextStatus, businessType, roles = []) {
    const id = positiveInteger(saleId, 'saleId');
    const sale = await this.repository.findKitchenSale(id, userId);
    if (!sale) throw HttpError.notFound('Sale not found');
    if (sale.status === DOCUMENT_STATUS.VOID) throw HttpError.conflict('Sale is void');
    if (businessType !== 'restaurant' && sale.orderChannel === 'delivery') {
      throw HttpError.conflict('Manage delivery order progress from Domicilios');
    }

    const currentStatus = sale.orderStatus ?? sale.kitchenStatus ?? ORDER_STATUS.PENDING;
    const allowedNext = {
      [ORDER_STATUS.PENDING]: [ORDER_STATUS.PREPARING],
      [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY],
      [ORDER_STATUS.READY]: sale.orderChannel === 'delivery'
        ? []
        : [ORDER_STATUS.DELIVERED],
    }[currentStatus] ?? [];
    if (!allowedNext.includes(nextStatus)) {
      throw HttpError.conflict(`Cannot change order status from ${currentStatus} to ${nextStatus}`);
    }

    const allowedRoles = this.#allowedPreparationRoles(sale, businessType);
    if (!roles.some((role) => allowedRoles.includes(role))) {
      throw HttpError.forbidden('Your role cannot advance this order');
    }
    if ((businessType === 'restaurant') !== (sale.kitchenStatus != null)) {
      throw HttpError.conflict('This order belongs to a different preparation workflow');
    }

    const now = new Date();
    const timeline = {};
    if (nextStatus === ORDER_STATUS.PREPARING) timeline.startedAt = now;
    if (nextStatus === ORDER_STATUS.READY) timeline.readyAt = now;
    if (nextStatus === ORDER_STATUS.DELIVERED) timeline.deliveredAt = now;

    return this.repository.withTransaction(async (session) => {
      const result = await this.repository.setOrderProgressInSession(
        id,
        userId,
        currentStatus,
        nextStatus,
        timeline,
        session,
      );
      if (result.matchedCount !== 1) {
        throw HttpError.conflict('Order status changed; refresh and try again');
      }
      await deliveriesService.syncFromKitchen(id, userId, nextStatus, session);
      return { id, orderStatus: nextStatus };
    });
  }

  #allowedPreparationRoles(sale, businessType) {
    if (businessType !== 'restaurant') return ['ADMIN', 'SELLER'];
    return ['ADMIN', 'SELLER', 'WAITER', 'CASHIER', 'COOK'];
  }

  async setOrderStatusFromDelivery(saleId, userId, status, session) {
    const result = await this.repository.setOrderStatusInSession(
      positiveInteger(saleId, 'saleId'),
      userId,
      status,
      session,
    );
    if (result.matchedCount !== 1) throw HttpError.conflict('The sale linked to this delivery no longer exists');
    return result;
  }

  /**
   * Registra el cobro de una venta "por cobrar": la marca como pagada, sella la
   * fecha y, al concretarse, suma las métricas de fidelización del cliente.
   * Todo en una transacción. Idempotente frente a ventas ya pagadas.
   */
  async pay(saleId, userId) {
    const id = positiveInteger(saleId, 'saleId');

    return this.repository.withTransaction(async (session) => {
      const sale = await this.repository.findOwnedInSession(id, userId, session);
      if (!sale) throw HttpError.notFound('Sale not found');
      if (sale.status === DOCUMENT_STATUS.VOID) throw HttpError.conflict('Sale is void');
      if (sale.paymentStatus === PAYMENT_STATUS.PAID) {
        throw HttpError.conflict('Sale is already paid');
      }
      const now = new Date();
      await this.repository.updateOwnedInSession(
        id,
        userId,
        { $set: { paymentStatus: PAYMENT_STATUS.PAID, paidAt: now, updatedBy: userId } },
        session,
      );

      // Al concretar el cobro, sumar las métricas de fidelización del cliente.
      const customer = await customersService.getActiveForDocument(sale.customerId, userId, session);
      if (customer) {
        await customersService.recordSale(customer, sale.total, now, userId, session);
      }

      return { id, paymentStatus: PAYMENT_STATUS.PAID, paidAt: now };
    });
  }
}

module.exports = { salesService: new SalesService() };
