'use strict';

const { HttpError, RECORD_STATUS, UniqueNumberUtil } = require('nemkit');
const Sale = require('./sales.model');
const Customer = require('../customers/customers.model');
const Product = require('../products/products.model');
const Movement = require('../movements/movements.model');
const Delivery = require('../deliveries/deliveries.model');
const Employee = require('../employees/employees.model');
const { InventoryDocumentService } = require('../documents/document.service');
const { positiveInteger } = require('../validation');
const {
  PRODUCT_TYPE,
  MOVEMENT_TYPE,
  MOVEMENT_DIRECTION,
  DOCUMENT_STATUS,
  PAYMENT_STATUS,
  CANCEL_REASONS,
  DELIVERY_STATUS,
  EMPLOYEE_ROLE,
  EMPLOYEE_STATUS,
  KITCHEN_STATUS,
  KITCHEN_STATUSES,
  KITCHEN_TRANSITIONS,
  KITCHEN_TO_DELIVERY_STATUS,
  resolveLoyaltyTier,
} = require('../inventory.constants');

class SalesService extends InventoryDocumentService {
  constructor() {
    super({
      model: Sale,
      contactModel: Customer,
      contactField: 'customerId',
      movementType: MOVEMENT_TYPE.SALE,
      direction: MOVEMENT_DIRECTION.OUT,
      amountField: 'unitPrice',
      label: 'Sale',
      requiredContact: true,
    });
  }

  /**
   * Si la venta es a domicilio (data.delivery presente), crea el pedido de
   * entrega vinculado a la venta dentro de la misma transacción. La venta ya
   * descontó el stock; el domicilio es logística de entrega (no vuelve a tocar
   * existencias ni genera otra venta).
   */
  async afterCreate({ document, data, contact, items, userId, session }) {
    const delivery = data.delivery;
    if (!delivery) return;

    const address = typeof delivery.address === 'string' ? delivery.address.trim() : '';
    if (!address || address.length > 300) {
      throw HttpError.badRequest('delivery.address is required and must be at most 300 characters');
    }

    const location = this.#validateDeliveryLocation(delivery.location);
    const courier = await this.#resolveCourier(userId, delivery.courierId, session);

    await Delivery.create([{
      _id: UniqueNumberUtil.generateRaw(),
      userId,
      saleId: document._id,
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
    }], { session });
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
    const employee = await Employee.findOne({
      _id: id,
      userId,
      role: EMPLOYEE_ROLE.COURIER,
      status: EMPLOYEE_STATUS.ACTIVE,
      recordStatus: RECORD_STATUS.ACTIVE,
    }).select('_id name').session(session).lean();
    if (!employee) throw HttpError.badRequest('Invalid or inactive courier');
    return { courierId: employee._id, courierSnapshot: { name: employee.name } };
  }

  /**
   * Anula una venta: repone el stock, registra un movimiento de reversa,
   * marca la venta como anulada y revierte las métricas del cliente. Todo en
   * una transacción. Idempotente frente a ventas ya anuladas.
   *
   * @param {number} saleId
   * @param {number} userId - tenant
   * @param {Object} [options]
   * @param {string} [options.reason]     - código de motivo (CANCEL_REASON)
   * @param {string} [options.note]       - nota libre opcional (p. ej. para 'other')
   */
  async voidSale(saleId, userId, { reason = '', note = '' } = {}) {
    const id = positiveInteger(saleId, 'saleId');
    const reasonCode = CANCEL_REASONS.includes(reason) ? reason : '';
    const voidNote = typeof note === 'string' ? note.trim().slice(0, 300) : '';

    return this.repository.withTransaction(async (session) => {
      const sale = await Sale.findOne({
        _id: id,
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
      }).session(session).lean();
      if (!sale) throw HttpError.notFound('Sale not found');
      if (sale.status === DOCUMENT_STATUS.VOID) {
        throw HttpError.conflict('Sale is already void');
      }

      // Reponer stock EXPANDIENDO recetas, igual que se descontó en la venta:
      // un plato (prepared) no repone stock propio, repone el de sus insumos.
      const soldIds = [...new Set(sale.items.map((item) => item.productId))];
      const soldProducts = await Product.find({ userId, _id: { $in: soldIds } })
        .select('_id type recipe purchasePrice name')
        .session(session)
        .lean();
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
        await Product.updateOne(
          { _id: productId, userId },
          { $inc: { stock: qty } },
          { session },
        );
      }

      // Movimiento de reversa (entrada) con el consumo físico real (insumos expandidos).
      const ingredientById = new Map(soldProducts.map((p) => [p._id, p]));
      const missingIds = [...restock.keys()].filter((pid) => !ingredientById.has(pid));
      if (missingIds.length) {
        const extra = await Product.find({ userId, _id: { $in: missingIds } })
          .select('_id purchasePrice').session(session).lean();
        for (const p of extra) ingredientById.set(p._id, p);
      }
      // Movimiento de reversa solo si hubo stock que reponer. Una venta de solo
      // platos sin receta no descontó nada, así que tampoco genera reversa.
      let voidMovementId = null;
      if (restock.size > 0) {
        voidMovementId = UniqueNumberUtil.generateRaw();
        await Movement.create([{
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
        }], { session });
      }

      // Marcar la venta como anulada, guardando el motivo de cancelación.
      await Sale.updateOne(
        { _id: id, userId },
        {
          status: DOCUMENT_STATUS.VOID,
          voidReason: reasonCode,
          voidNote,
          voidedAt: new Date(),
          updatedBy: userId,
        },
        { session },
      );

      // Revertir métricas de fidelización solo si la venta llegó a cobrarse
      // (una venta "por cobrar" nunca sumó al cliente).
      const customer = sale.paymentStatus === PAYMENT_STATUS.PAID
        ? await Customer.findOne({
          _id: sale.customerId,
          userId,
          recordStatus: RECORD_STATUS.ACTIVE,
        }).session(session).lean()
        : null;
      if (customer) {
        const newSpent = Math.max(0, this.#round(previousSpentOf(customer) - sale.total));
        const newCount = Math.max(0, (customer.stats?.purchaseCount ?? 0) - 1);
        await Customer.updateOne(
          { _id: customer._id, userId },
          {
            $set: {
              'stats.totalSpent': newSpent,
              'stats.purchaseCount': newCount,
              loyaltyTier: resolveLoyaltyTier(newSpent, newCount),
              updatedBy: userId,
            },
          },
          { session },
        );
      }

      return { id, status: DOCUMENT_STATUS.VOID, voidMovementId };
    });
  }

  #round(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /**
   * Cola de cocina: comandas activas (no servidas) ordenadas por antigüedad.
   * Por defecto excluye las ya servidas; `includeServed` las incluye.
   */
  async kitchenQueue(userId, query = {}) {
    const filter = {
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
      kitchenStatus: { $ne: null },
      status: { $ne: DOCUMENT_STATUS.VOID }, // las comandas canceladas salen de la cola
    };
    if (!query.includeServed) {
      filter.kitchenStatus = { $in: [KITCHEN_STATUS.PENDING, KITCHEN_STATUS.PREPARING, KITCHEN_STATUS.READY] };
    }
    const sales = await Sale.find(filter)
      .select('_id date tableNumber kitchenStatus kitchenTimeline paymentStatus paidAt items total customerSnapshot employeeSnapshot notes')
      .sort({ date: 1 })
      .limit(200)
      .lean();
    return sales.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
  }

  /**
   * Cambia el estado de cocina de una comanda validando transiciones y sellando
   * los hitos de tiempo. Solo aplica a ventas que entraron a cocina.
   */
  async changeKitchenStatus(saleId, nextStatus, userId) {
    const id = positiveInteger(saleId, 'saleId');
    if (!KITCHEN_STATUSES.includes(nextStatus)) {
      throw HttpError.badRequest(`kitchenStatus must be one of: ${KITCHEN_STATUSES.join(', ')}`);
    }
    const sale = await Sale.findOne({ _id: id, userId, recordStatus: RECORD_STATUS.ACTIVE }).lean();
    if (!sale) throw HttpError.notFound('Sale not found');
    if (sale.kitchenStatus == null) throw HttpError.badRequest('This sale is not a kitchen order');

    const allowed = KITCHEN_TRANSITIONS[sale.kitchenStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw HttpError.conflict(`Cannot change kitchen status from ${sale.kitchenStatus} to ${nextStatus}`);
    }

    const update = { kitchenStatus: nextStatus };
    const now = new Date();
    if (nextStatus === KITCHEN_STATUS.PREPARING) update['kitchenTimeline.startedAt'] = now;
    if (nextStatus === KITCHEN_STATUS.READY) update['kitchenTimeline.readyAt'] = now;
    if (nextStatus === KITCHEN_STATUS.SERVED) update['kitchenTimeline.servedAt'] = now;

    await Sale.updateOne({ _id: id, userId }, { $set: { ...update, updatedBy: userId } });

    // Sincronizar el domicilio asociado (si existe): el pedido es una sola línea
    // de estados. La cocina dicta pending/preparing/ready; de ahí en adelante el
    // reparto lo maneja el domiciliario. No se toca si ya pasó a reparto
    // (picked_up/on_route) ni si terminó (delivered/cancelled). 'served' no mapea.
    await this.#syncDeliveryFromKitchen(id, nextStatus, userId);

    return { id, kitchenStatus: nextStatus };
  }

  /**
   * Propaga el estado de cocina al domicilio asociado, solo mientras el pedido
   * sigue en fase de cocina. No bloquea el flujo si no hay domicilio o si ya
   * está en manos del domiciliario.
   */
  async #syncDeliveryFromKitchen(saleId, kitchenStatus, userId) {
    const target = KITCHEN_TO_DELIVERY_STATUS[kitchenStatus];
    if (!target) return; // 'served' u otro: el domicilio no se ve afectado.

    const delivery = await Delivery.findOne({ saleId, userId, recordStatus: RECORD_STATUS.ACTIVE })
      .select('_id status').lean();
    if (!delivery) return; // venta de mesa/para llevar: no hay domicilio.

    // Solo mover si el domicilio sigue en fase de cocina (no lo recogió aún el
    // domiciliario ni terminó). Evita pisar el trabajo del repartidor.
    const kitchenPhase = [DELIVERY_STATUS.PENDING, DELIVERY_STATUS.PREPARING, DELIVERY_STATUS.READY];
    if (!kitchenPhase.includes(delivery.status) || delivery.status === target) return;

    const update = { status: target, updatedBy: userId };
    await Delivery.updateOne({ _id: delivery._id, userId }, { $set: update });
  }

  /**
   * Registra el cobro de una venta "por cobrar": la marca como pagada, sella la
   * fecha y, al concretarse, suma las métricas de fidelización del cliente.
   * Todo en una transacción. Idempotente frente a ventas ya pagadas.
   */
  async pay(saleId, userId) {
    const id = positiveInteger(saleId, 'saleId');

    return this.repository.withTransaction(async (session) => {
      const sale = await Sale.findOne({
        _id: id,
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
      }).session(session).lean();
      if (!sale) throw HttpError.notFound('Sale not found');
      if (sale.status === DOCUMENT_STATUS.VOID) throw HttpError.conflict('Sale is void');
      if (sale.paymentStatus === PAYMENT_STATUS.PAID) {
        throw HttpError.conflict('Sale is already paid');
      }

      const now = new Date();
      await Sale.updateOne(
        { _id: id, userId },
        { $set: { paymentStatus: PAYMENT_STATUS.PAID, paidAt: now, updatedBy: userId } },
        { session },
      );

      // Al concretar el cobro, sumar las métricas de fidelización del cliente.
      const customer = await Customer.findOne({
        _id: sale.customerId,
        userId,
        recordStatus: RECORD_STATUS.ACTIVE,
      }).session(session).lean();
      if (customer) {
        const newSpent = this.#round((customer.stats?.totalSpent ?? 0) + sale.total);
        const newCount = (customer.stats?.purchaseCount ?? 0) + 1;
        const firstPurchaseAt = customer.stats?.firstPurchaseAt ?? now;
        await Customer.updateOne(
          { _id: customer._id, userId },
          {
            $set: {
              'stats.totalSpent': newSpent,
              'stats.purchaseCount': newCount,
              'stats.firstPurchaseAt': firstPurchaseAt,
              'stats.lastPurchaseAt': now,
              loyaltyTier: resolveLoyaltyTier(newSpent, newCount),
              updatedBy: userId,
            },
          },
          { session },
        );
      }

      return { id, paymentStatus: PAYMENT_STATUS.PAID, paidAt: now };
    });
  }
}

function previousSpentOf(customer) {
  return customer.stats?.totalSpent ?? 0;
}

module.exports = { salesService: new SalesService() };
