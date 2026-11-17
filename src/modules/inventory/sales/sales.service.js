'use strict';

const { HttpError, UniqueNumberUtil } = require('nemkit');
const { productsService } = require('../products/products.service');
const { movementsService } = require('../movements/movements.service');
const { deliveriesService } = require('../deliveries/deliveries.service');
const { InventoryDocumentService } = require('../documents/document.service');
const { SalesRepository } = require('./sales.repository');
const { createDeliveryForSale } = require('./sale-delivery');
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
    this.statisticsOperations = null;
  }

  setStatisticsOperations({ recordCustomerPurchase, reverseCustomerPurchase }) {
    if (typeof recordCustomerPurchase !== 'function' || typeof reverseCustomerPurchase !== 'function') {
      throw new TypeError('Sales statistics operations must provide customer purchase updates');
    }
    this.statisticsOperations = { recordCustomerPurchase, reverseCustomerPurchase };
  }

  #getStatisticsOperations() {
    if (!this.statisticsOperations) {
      throw new Error('Sales statistics operations have not been configured');
    }
    return this.statisticsOperations;
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
   * entrega vinculado a la venta dentro de la misma transacción.
   */
  async afterCreate({ document, data, contact, items, userId, session }) {
    if (document.paymentStatus === PAYMENT_STATUS.PAID && contact) {
      const { recordCustomerPurchase } = this.#getStatisticsOperations();
      await recordCustomerPurchase(contact, document.total, document.date, userId, session);
    }

    return createDeliveryForSale({
      document,
      delivery: data.delivery,
      contact,
      items,
      fromKitchen: data.kitchenStatus != null,
      userId,
      session,
    });
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
        const { reverseCustomerPurchase } = this.#getStatisticsOperations();
        await reverseCustomerPurchase(sale.customerId, sale.total, userId, session);
      }

      return { id, status: DOCUMENT_STATUS.VOID, voidMovementId };
    });
  }

  hasCustomerSales(userId, customerId) {
    return this.repository.hasCustomerSales(userId, customerId);
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
        const { recordCustomerPurchase } = this.#getStatisticsOperations();
        await recordCustomerPurchase(customer, sale.total, now, userId, session);
      }

      return { id, paymentStatus: PAYMENT_STATUS.PAID, paidAt: now };
    });
  }
}

module.exports = { salesService: new SalesService() };
