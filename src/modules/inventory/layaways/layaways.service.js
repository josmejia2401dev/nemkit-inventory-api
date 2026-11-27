'use strict';

const {
  BaseService,
  HttpError,
  UniqueNumberUtil,
  RECORD_STATUS,
} = require('nemkit');
const { LayawaysRepository } = require('./layaways.repository');
const { LayawaySettingsRepository } = require('./layaway-settings.repository');
const { LayawayPaymentsRepository } = require('./layaway-payments.repository');
const { productsService } = require('../products/products.service');
const { customersService } = require('../customers/customers.service');
const { movementsService } = require('../movements/movements.service');
const { salesService } = require('../sales/sales.service');
const { employeesService } = require('../../../config/foundation-services.js');
const {
  pagination,
  positiveInteger,
  parseDate,
  escapeRegex,
} = require('../validation');
const { roundMoney } = require('../documents/pricing');
const {
  PRODUCT_TYPE,
  MOVEMENT_TYPE,
  MOVEMENT_DIRECTION,
  MOVEMENT_SOURCE_TYPE,
  LAYAWAY_STATUS,
  LAYAWAY_STATUSES,
  LAYAWAY_FREQUENCIES,
  LAYAWAY_PAYMENT_METHODS,
  LAYAWAY_PAYMENT_TYPE,
  LAYAWAY_HANDOVER_MODE,
  LAYAWAY_HANDOVER_MODES,
  LAYAWAY_HANDOVER_STATUS,
  LAYAWAY_CANCELLATION_POLICY,
  LAYAWAY_RETURN_CONDITION,
  LAYAWAY_RETURN_CONDITIONS,
  LAYAWAY_CANCEL_REASONS,
  LAYAWAY_DEFAULT_SETTINGS,
} = require('../inventory.constants');

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function nextDueDate(startDate, frequency, dueDate) {
  const next = new Date(startDate);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  else if (frequency === 'biweekly') next.setDate(next.getDate() + 14);
  else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  else return null;
  return next <= dueDate ? next : null;
}

function decorate(document, now = new Date()) {
  if (!document) return document;
  const balance = roundMoney(document.balance ?? 0);
  const overdue = document.status === LAYAWAY_STATUS.ACTIVE
    && balance > 0
    && new Date(document.dueDate) < now;
  const paidAmount = roundMoney(document.paidAmount ?? 0);
  const total = roundMoney(document.total ?? 0);
  return {
    ...document,
    balance,
    paidAmount,
    overdue,
    progressPercent: total > 0 ? Math.min(100, Math.round((paidAmount / total) * 100)) : 0,
    daysOverdue: overdue
      ? Math.max(0, Math.floor((now.getTime() - new Date(document.dueDate).getTime()) / 86400000))
      : 0,
  };
}

class LayawaysService extends BaseService {
  constructor() {
    super(new LayawaysRepository());
    this.paymentsRepository = new LayawayPaymentsRepository();
    this.settingsRepository = new LayawaySettingsRepository();
  }

  // ── Configuración por empresa ──────────────────────────────────────────────

  async getSettings(userId) {
    const settings = await this.settingsRepository.findByUser(userId);
    return this.#normalizeSettings(settings);
  }

  async updateSettings(userId, data, actorId) {
    const current = await this.getSettings(userId);
    const next = this.#normalizeSettings({ ...current, ...data });
    await this.settingsRepository.save(userId, next, actorId);
    return next;
  }

  #normalizeSettings(raw = {}) {
    const value = raw ?? {};
    const clamp = (number, min, max) => Math.min(max, Math.max(min, Number(number)));
    const frequency = LAYAWAY_FREQUENCIES.includes(value.defaultFrequency)
      ? value.defaultFrequency
      : LAYAWAY_DEFAULT_SETTINGS.defaultFrequency;
    const cancellationPolicy = Object.values(LAYAWAY_CANCELLATION_POLICY).includes(value.cancellationPolicy)
      ? value.cancellationPolicy
      : LAYAWAY_DEFAULT_SETTINGS.cancellationPolicy;
    return {
      minInitialPercent: Number.isFinite(Number(value.minInitialPercent))
        ? clamp(value.minInitialPercent, 0, 100)
        : LAYAWAY_DEFAULT_SETTINGS.minInitialPercent,
      maxTermMonths: Number.isFinite(Number(value.maxTermMonths))
        ? clamp(value.maxTermMonths, 1, 60)
        : LAYAWAY_DEFAULT_SETTINGS.maxTermMonths,
      defaultFrequency: frequency,
      cancellationPolicy,
      retentionPercent: Number.isFinite(Number(value.retentionPercent))
        ? clamp(value.retentionPercent, 0, 100)
        : LAYAWAY_DEFAULT_SETTINGS.retentionPercent,
      allowImmediateHandover: value.allowImmediateHandover !== false,
    };
  }

  // ── Listado y detalle ─────────────────────────────────────────────────────

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);
    const filter = {
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    };

    if (query.status !== undefined) {
      if (!LAYAWAY_STATUSES.includes(query.status)) {
        throw HttpError.badRequest(`status must be one of: ${LAYAWAY_STATUSES.join(', ')}`);
      }
      filter.status = query.status;
    }

    if (query.customerId !== undefined) {
      filter.customerId = positiveInteger(query.customerId, 'customerId');
    }

    if (query.overdue === 'true' || query.overdue === true) {
      filter.status = LAYAWAY_STATUS.ACTIVE;
      filter.balance = { $gt: 0 };
      filter.dueDate = { $lt: new Date() };
    }

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search) {
      if (search.length > 100) throw HttpError.badRequest('search is too long');
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { 'customerSnapshot.name': regex },
        { 'customerSnapshot.document': regex },
        { 'customerSnapshot.phone': regex },
      ];
      if (/^\d+$/.test(search)) filter.$or.push({ _id: Number(search) });
    }

    const from = parseDate(query.from, 'from');
    const to = parseDate(query.to, 'to');
    if (from && to && from > to) throw HttpError.badRequest('from must be before to');

    const [result, summary] = await Promise.all([
      this.filterAndPaginate(filter, {
        page,
        limit,
        sort: { createdAt: -1, _id: -1 },
        between: { field: 'startDate', from, to },
      }),
      this.repository.summary(userId),
    ]);

    return {
      ...result,
      data: result.data.map((document) => decorate(document)),
      summary,
    };
  }

  async getOwned(id, userId) {
    const layawayId = positiveInteger(id, 'layawayId');
    const document = await this.findOne({
      _id: layawayId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });
    if (!document) throw HttpError.notFound('Layaway not found');
    return document;
  }

  async getDetail(id, userId) {
    const document = await this.getOwned(id, userId);
    const payments = await this.paymentsRepository.listByLayaway(userId, document.id ?? document._id);
    return {
      ...decorate(document),
      payments: payments.map((payment) => ({
        ...payment,
        id: payment._id ?? payment.id,
      })),
    };
  }

  // ── Crear ─────────────────────────────────────────────────────────────────

  async create(data, userId, actor = {}) {
    const customerId = positiveInteger(data.customerId, 'customerId');
    const itemsInput = this.#validateItems(data.items);
    const startDate = data.startDate ? parseDate(data.startDate, 'startDate') : new Date();
    const dueDate = parseDate(data.dueDate, 'dueDate');
    if (!dueDate) throw HttpError.badRequest('dueDate is required');
    if (dueDate < startDate) throw HttpError.badRequest('dueDate must be after startDate');

    const settings = await this.getSettings(userId);
    const maxDueDate = addMonths(startDate, settings.maxTermMonths);
    if (dueDate > maxDueDate) {
      throw HttpError.badRequest(`dueDate cannot exceed ${settings.maxTermMonths} months`);
    }

    const initialPayment = roundMoney(Number(data.initialPayment ?? 0));
    if (!Number.isFinite(initialPayment) || initialPayment < 0) {
      throw HttpError.badRequest('initialPayment must be a non-negative number');
    }

    const frequency = data.frequency ?? settings.defaultFrequency;
    if (!LAYAWAY_FREQUENCIES.includes(frequency)) {
      throw HttpError.badRequest(`frequency must be one of: ${LAYAWAY_FREQUENCIES.join(', ')}`);
    }

    const handoverMode = data.handoverMode ?? LAYAWAY_HANDOVER_MODE.PICKUP;
    if (!LAYAWAY_HANDOVER_MODES.includes(handoverMode)) {
      throw HttpError.badRequest(`handoverMode must be one of: ${LAYAWAY_HANDOVER_MODES.join(', ')}`);
    }
    if (handoverMode === LAYAWAY_HANDOVER_MODE.IMMEDIATE && !settings.allowImmediateHandover) {
      throw HttpError.conflict('Immediate handover is disabled for this company');
    }

    const delivery = this.#validateDelivery(data.delivery, handoverMode);
    const notes = typeof data.notes === 'string' ? data.notes.trim().slice(0, 1000) : '';
    const initialPaymentMethod = data.initialPaymentMethod ?? 'cash';
    if (!LAYAWAY_PAYMENT_METHODS.includes(initialPaymentMethod)) {
      throw HttpError.badRequest('Invalid initial payment method');
    }

    const customer = await customersService.getActiveForDocument(customerId, userId);
    if (!customer) throw HttpError.badRequest('Invalid or inactive customer');

    const layawayId = UniqueNumberUtil.generateRaw();
    const reservationMovementId = UniqueNumberUtil.generateRaw();

    await this.repository.withTransaction(async (session) => {
      const productById = new Map(
        (await productsService.findActiveForStockChange(
          userId,
          itemsInput.map((item) => item.productId),
          session,
        )).map((product) => [product._id, product]),
      );

      if (productById.size !== itemsInput.length) {
        throw HttpError.badRequest('One or more products are invalid or inactive');
      }

      const items = itemsInput.map((item) => {
        const product = productById.get(item.productId);
        if (product.type !== PRODUCT_TYPE.SIMPLE) {
          throw HttpError.badRequest(`"${product.name}" is not a tangible product`);
        }
        if ((product.stock ?? 0) < item.quantity) {
          throw HttpError.conflict(`Insufficient stock for ${product.name}`);
        }
        const unitPrice = item.unitPrice ?? product.salePrice;
        return {
          productId: product._id,
          sku: product.sku,
          name: product.name,
          quantity: item.quantity,
          unitPrice: roundMoney(unitPrice),
          unitCost: roundMoney(product.purchasePrice ?? 0),
          lineTotal: roundMoney(unitPrice * item.quantity),
        };
      });

      const total = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
      if (initialPayment > total) {
        throw HttpError.badRequest('initialPayment cannot exceed the total');
      }

      const minimumInitial = roundMoney((total * settings.minInitialPercent) / 100);
      if (initialPayment < minimumInitial) {
        throw HttpError.badRequest(
          `initialPayment must be at least ${settings.minInitialPercent}% of the total`,
        );
      }

      if (data.installmentAmount != null) {
        const installment = roundMoney(Number(data.installmentAmount));
        if (!Number.isFinite(installment) || installment < 0 || installment > total - initialPayment) {
          throw HttpError.badRequest('installmentAmount must be between zero and the remaining balance');
        }
      }

      const balance = roundMoney(total - initialPayment);
      const isImmediate = handoverMode === LAYAWAY_HANDOVER_MODE.IMMEDIATE;

      const { employeeId, employeeSnapshot } = await employeesService.resolveResponsible(
        userId,
        data.employeeId,
        session,
      );

      for (const item of items) {
        const result = await productsService.changeStock(
          userId,
          item.productId,
          item.quantity,
          MOVEMENT_DIRECTION.OUT,
          session,
        );
        if (result.modifiedCount !== 1) {
          throw HttpError.conflict(`Stock changed for ${item.name}; retry the layaway`);
        }
      }

      await movementsService.recordDocumentMovement({
        _id: reservationMovementId,
        userId,
        date: startDate,
        type: MOVEMENT_TYPE.LAYAWAY_RESERVE,
        notes: `Reserva Plan separe #${layawayId}`,
        employeeId,
        employeeSnapshot,
        sourceType: MOVEMENT_SOURCE_TYPE.LAYAWAY_RESERVE,
        sourceId: layawayId,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          direction: MOVEMENT_DIRECTION.OUT,
          unitCost: item.unitCost,
        })),
        createdBy: userId,
        updatedBy: userId,
      }, session);

      const status = balance === 0
        ? (isImmediate ? LAYAWAY_STATUS.COMPLETED : LAYAWAY_STATUS.READY)
        : LAYAWAY_STATUS.ACTIVE;

      const layawayData = {
        _id: layawayId,
        userId,
        customerId,
        customerSnapshot: {
          name: customer.name,
          document: customer.document ?? '',
          phone: customer.phone ?? '',
          email: customer.email ?? '',
        },
        items,
        total,
        initialPayment,
        paidAmount: initialPayment,
        balance,
        installmentAmount: data.installmentAmount != null
          ? roundMoney(Number(data.installmentAmount))
          : 0,
        frequency,
        startDate,
        dueDate,
        nextDueDate: balance > 0 ? nextDueDate(startDate, frequency, dueDate) : null,
        status,
        paymentStatus: balance === 0 ? 'paid' : 'pending',
        handoverMode,
        handoverStatus: isImmediate
          ? LAYAWAY_HANDOVER_STATUS.DELIVERED
          : LAYAWAY_HANDOVER_STATUS.PENDING,
        deliveredAt: isImmediate ? startDate : null,
        delivery,
        settingsSnapshot: settings,
        reservationMovementId,
        releaseMovementId: null,
        saleId: null,
        saleCreatedAt: null,
        cancelledAt: null,
        cancellation: null,
        notes,
        createdBy: actor.actorId ?? userId,
        updatedBy: actor.actorId ?? userId,
      };

      await this.repository.createInSession(layawayData, session);

      if (initialPayment > 0) {
        await this.paymentsRepository.createInSession({
          _id: UniqueNumberUtil.generateRaw(),
          userId,
          layawayId,
          type: LAYAWAY_PAYMENT_TYPE.INITIAL,
          date: startDate,
          amount: initialPayment,
          method: initialPaymentMethod,
          reference: typeof data.initialPaymentReference === 'string'
            ? data.initialPaymentReference.trim().slice(0, 100)
            : '',
          notes: '',
          employeeId,
          employeeSnapshot,
          createdBy: actor.actorId ?? userId,
          updatedBy: actor.actorId ?? userId,
        }, session);
      }

      if (isImmediate) {
        const sale = await salesService.createFromLayaway({
          layaway: layawayData,
          customer,
          userId,
          date: startDate,
          paid: balance === 0,
          session,
          delivery,
        });
        const saleId = sale.id ?? sale._id;
        await this.repository.updateOwnedInSession(
          layawayId,
          userId,
          { $set: { saleId, saleCreatedAt: startDate } },
          session,
        );
        layawayData.saleId = saleId;
        layawayData.saleCreatedAt = startDate;
      }

    });

    return this.getDetail(layawayId, userId);
  }

  // ── Actualizar ────────────────────────────────────────────────────────────

  async update(id, data, userId) {
    const layawayId = positiveInteger(id, 'layawayId');
    const current = await this.getOwned(layawayId, userId);
    if (![LAYAWAY_STATUS.ACTIVE, LAYAWAY_STATUS.READY].includes(current.status)) {
      throw HttpError.conflict('Only active or ready layaways can be updated');
    }

    const update = {};
    if (data.dueDate !== undefined) {
      const dueDate = parseDate(data.dueDate, 'dueDate');
      if (!dueDate) throw HttpError.badRequest('dueDate is required');
      const settings = await this.getSettings(userId);
      const maxDueDate = addMonths(current.startDate, settings.maxTermMonths);
      if (dueDate < current.startDate || dueDate > maxDueDate) {
        throw HttpError.badRequest(`dueDate must be between startDate and ${settings.maxTermMonths} months`);
      }
      update.dueDate = dueDate;
      update.nextDueDate = current.balance > 0
        ? nextDueDate(current.startDate, data.frequency ?? current.frequency, dueDate)
        : null;
    }
    if (data.frequency !== undefined) {
      if (!LAYAWAY_FREQUENCIES.includes(data.frequency)) {
        throw HttpError.badRequest(`frequency must be one of: ${LAYAWAY_FREQUENCIES.join(', ')}`);
      }
      update.frequency = data.frequency;
      if (data.dueDate === undefined && current.balance > 0) {
        update.nextDueDate = nextDueDate(current.startDate, data.frequency, current.dueDate);
      }
    }
    if (data.installmentAmount !== undefined) {
      const amount = roundMoney(Number(data.installmentAmount));
      if (!Number.isFinite(amount) || amount < 0) {
        throw HttpError.badRequest('installmentAmount must be a non-negative number');
      }
      update.installmentAmount = amount;
    }
    if (data.notes !== undefined) {
      if (typeof data.notes !== 'string' || data.notes.length > 1000) {
        throw HttpError.badRequest('notes must be at most 1000 characters');
      }
      update.notes = data.notes.trim();
    }
    if (!Object.keys(update).length) {
      throw HttpError.badRequest('At least one updatable field is required');
    }
    update.updatedBy = userId;

    await this.repository.updateOwnedInSession(
      layawayId,
      userId,
      { $set: update },
      null,
    );
    return this.getDetail(layawayId, userId);
  }

  // ── Abonos ────────────────────────────────────────────────────────────────

  async addPayment(id, data, userId, actor = {}) {
    const layawayId = positiveInteger(id, 'layawayId');
    const amount = roundMoney(Number(data.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw HttpError.badRequest('amount must be greater than zero');
    }
    const method = data.method ?? 'cash';
    if (!LAYAWAY_PAYMENT_METHODS.includes(method)) {
      throw HttpError.badRequest(`method must be one of: ${LAYAWAY_PAYMENT_METHODS.join(', ')}`);
    }
    const date = data.date ? parseDate(data.date, 'date') : new Date();

    await this.repository.withTransaction(async (session) => {
      const current = await this.repository.findOwnedInSession(layawayId, userId, session);
      if (!current) throw HttpError.notFound('Layaway not found');
      if (current.status !== LAYAWAY_STATUS.ACTIVE) {
        throw HttpError.conflict('Only active layaways accept payments');
      }
      if (amount > current.balance) {
        throw HttpError.conflict('Payment cannot exceed the remaining balance');
      }

      const newBalance = roundMoney(current.balance - amount);
      const isPaid = newBalance === 0;
      const handoverDelivered = current.handoverStatus === LAYAWAY_HANDOVER_STATUS.DELIVERED;
      const setFields = {
        paymentStatus: isPaid ? 'paid' : 'pending',
        nextDueDate: isPaid ? null : current.nextDueDate,
        updatedBy: userId,
        ...(isPaid
          ? { status: handoverDelivered ? LAYAWAY_STATUS.COMPLETED : LAYAWAY_STATUS.READY }
          : {}),
      };

      const updated = await this.repository.applyPaymentInSession(
        layawayId,
        userId,
        amount,
        setFields,
        session,
      );
      if (!updated) throw HttpError.conflict('The balance changed; retry the payment');

      const { employeeId, employeeSnapshot } = await employeesService.resolveResponsible(
        userId,
        data.employeeId,
        session,
      );

      await this.paymentsRepository.createInSession({
        _id: UniqueNumberUtil.generateRaw(),
        userId,
        layawayId,
        type: LAYAWAY_PAYMENT_TYPE.INSTALLMENT,
        date,
        amount,
        method,
        reference: typeof data.reference === 'string' ? data.reference.trim().slice(0, 100) : '',
        notes: typeof data.notes === 'string' ? data.notes.trim().slice(0, 300) : '',
        employeeId,
        employeeSnapshot,
        createdBy: actor.actorId ?? userId,
        updatedBy: actor.actorId ?? userId,
      }, session);

      if (isPaid && current.saleId) {
        await salesService.markLayawaySalePaid(current.saleId, userId, date, session);
      }
    });

    return this.getDetail(layawayId, userId);
  }

  // ── Entrega ───────────────────────────────────────────────────────────────

  async deliver(id, data, userId, actor = {}) {
    const layawayId = positiveInteger(id, 'layawayId');
    const date = data.date ? parseDate(data.date, 'date') : new Date();

    await this.repository.withTransaction(async (session) => {
      const current = await this.repository.findOwnedInSession(layawayId, userId, session);
      if (!current) throw HttpError.notFound('Layaway not found');
      if (current.status !== LAYAWAY_STATUS.READY) {
        throw HttpError.conflict('The layaway must be fully paid before delivery');
      }
      if (current.handoverStatus === LAYAWAY_HANDOVER_STATUS.DELIVERED) {
        throw HttpError.conflict('The layaway was already delivered');
      }

      const customer = await customersService.getActiveForDocument(
        current.customerId,
        userId,
        session,
      );
      if (!customer) throw HttpError.badRequest('Invalid or inactive customer');

      const sale = await salesService.createFromLayaway({
        layaway: current,
        customer,
        userId,
        date,
        paid: true,
        session,
        delivery: current.delivery,
      });
      const saleId = sale.id ?? sale._id;

      await this.repository.updateOwnedInSession(
        layawayId,
        userId,
        { $set: {
          status: LAYAWAY_STATUS.COMPLETED,
          handoverStatus: LAYAWAY_HANDOVER_STATUS.DELIVERED,
          deliveredAt: date,
          saleId,
          saleCreatedAt: date,
          updatedBy: actor.actorId ?? userId,
        } },
        session,
      );
    });

    return this.getDetail(layawayId, userId);
  }

  // ── Cancelación / devolución ──────────────────────────────────────────────

  async cancel(id, data, userId, actor = {}) {
    const layawayId = positiveInteger(id, 'layawayId');
    const reason = typeof data.reason === 'string' ? data.reason : '';
    if (!LAYAWAY_CANCEL_REASONS.includes(reason)) {
      throw HttpError.badRequest(`reason must be one of: ${LAYAWAY_CANCEL_REASONS.join(', ')}`);
    }
    const note = typeof data.note === 'string' ? data.note.trim().slice(0, 300) : '';
    const settings = await this.getSettings(userId);

    await this.repository.withTransaction(async (session) => {
      const current = await this.repository.findOwnedInSession(layawayId, userId, session);
      if (!current) throw HttpError.notFound('Layaway not found');
      if (![LAYAWAY_STATUS.ACTIVE, LAYAWAY_STATUS.READY].includes(current.status)) {
        throw HttpError.conflict('Only active or ready layaways can be cancelled');
      }

      const delivered = current.handoverStatus === LAYAWAY_HANDOVER_STATUS.DELIVERED;
      const productReturned = Boolean(data.productReturned);
      let returnCondition = data.returnCondition ?? null;
      if (delivered && !LAYAWAY_RETURN_CONDITIONS.includes(returnCondition)) {
        returnCondition = productReturned
          ? LAYAWAY_RETURN_CONDITION.RESELLABLE
          : LAYAWAY_RETURN_CONDITION.NOT_RETURNED;
      }
      if (delivered && !LAYAWAY_RETURN_CONDITIONS.includes(returnCondition)) {
        throw HttpError.badRequest('returnCondition is required when the product was delivered');
      }

      const paidAmount = roundMoney(current.paidAmount ?? 0);
      let refundAmount = data.refundAmount !== undefined
        ? roundMoney(Number(data.refundAmount))
        : this.#suggestedRefund(current, settings);
      if (!Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > paidAmount) {
        throw HttpError.badRequest('refundAmount must be between zero and the paid amount');
      }

      if (delivered && returnCondition === LAYAWAY_RETURN_CONDITION.NOT_RETURNED) {
        refundAmount = Math.min(refundAmount, 0);
      }
      const retainedAmount = roundMoney(paidAmount - refundAmount);
      const writeOffAmount = delivered && returnCondition === LAYAWAY_RETURN_CONDITION.NOT_RETURNED
        ? roundMoney(current.balance)
        : 0;

      let releaseMovementId = null;
      let restock = false;

      if (!delivered) {
        restock = true;
        for (const item of current.items) {
          await productsService.restoreStock(userId, item.productId, item.quantity, session);
        }
        releaseMovementId = UniqueNumberUtil.generateRaw();
        await movementsService.recordDocumentMovement({
          _id: releaseMovementId,
          userId,
          date: new Date(),
          type: MOVEMENT_TYPE.LAYAWAY_RELEASE,
          notes: `Liberación Plan separe #${layawayId}: ${reason}`,
          employeeId: current.employeeId ?? null,
          employeeSnapshot: current.employeeSnapshot ?? { name: '' },
          sourceType: MOVEMENT_SOURCE_TYPE.LAYAWAY_RELEASE,
          sourceId: layawayId,
          items: current.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            direction: MOVEMENT_DIRECTION.IN,
            unitCost: item.unitCost ?? 0,
          })),
          createdBy: actor.actorId ?? userId,
          updatedBy: actor.actorId ?? userId,
        }, session);
      } else if (current.saleId) {
        const saleReason = reason === 'payment_default' ? 'other' : reason;
        const saleNote = note || (reason === 'payment_default' ? 'Cancelación de Plan separe por incumplimiento' : '');
        if (returnCondition === LAYAWAY_RETURN_CONDITION.RESELLABLE) {
          restock = true;
          await salesService.voidSaleInSession(current.saleId, userId, {
            reason: saleReason,
            note: saleNote,
            actorId: actor.actorId ?? userId,
            actorName: actor.fullName ?? '',
            forceReverseLoyalty: true,
          }, session);
        } else if (returnCondition === LAYAWAY_RETURN_CONDITION.DAMAGED) {
          await salesService.voidSaleInSession(current.saleId, userId, {
            reason: saleReason,
            note: saleNote || 'Producto devuelto en mal estado',
            actorId: actor.actorId ?? userId,
            actorName: actor.fullName ?? '',
            skipRestock: true,
            forceReverseLoyalty: true,
          }, session);
        }
      }

      await this.repository.updateOwnedInSession(
        layawayId,
        userId,
        { $set: {
          status: LAYAWAY_STATUS.CANCELLED,
          cancelledAt: new Date(),
          releaseMovementId,
          cancellation: {
            reason,
            note,
            productReturned,
            returnCondition: returnCondition ?? LAYAWAY_RETURN_CONDITION.NOT_RETURNED,
            restock,
            refundAmount,
            refundMethod: data.refundMethod ?? 'cash',
            retainedAmount,
            writeOffAmount,
          },
          updatedBy: actor.actorId ?? userId,
        } },
        session,
      );
    });

    return this.getDetail(layawayId, userId);
  }

  #suggestedRefund(layaway, settings) {
    const paidAmount = roundMoney(layaway.paidAmount ?? 0);
    if (settings.cancellationPolicy === LAYAWAY_CANCELLATION_POLICY.REFUND_ALL) {
      return paidAmount;
    }
    if (settings.cancellationPolicy === LAYAWAY_CANCELLATION_POLICY.RETAIN_PERCENT) {
      return roundMoney(paidAmount * (1 - settings.retentionPercent / 100));
    }
    return paidAmount;
  }

  // ── Validaciones puras ────────────────────────────────────────────────────

  #validateItems(items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      throw HttpError.badRequest('items must contain between 1 and 100 entries');
    }
    const seen = new Set();
    return items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw HttpError.badRequest('Each item must be an object');
      }
      const productId = positiveInteger(item.productId, 'productId');
      if (seen.has(productId)) {
        throw HttpError.badRequest('A product can only appear once in the layaway');
      }
      seen.add(productId);
      const quantity = positiveInteger(item.quantity, 'quantity');
      let unitPrice = null;
      if (item.unitPrice !== undefined && item.unitPrice !== null) {
        unitPrice = Number(item.unitPrice);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw HttpError.badRequest('unitPrice must be a non-negative number');
        }
        unitPrice = roundMoney(unitPrice);
      }
      return { productId, quantity, unitPrice };
    });
  }

  #validateDelivery(delivery, handoverMode) {
    if (handoverMode !== LAYAWAY_HANDOVER_MODE.DELIVERY) return null;
    if (!delivery || typeof delivery !== 'object' || Array.isArray(delivery)) {
      throw HttpError.badRequest('delivery is required for home delivery');
    }
    const address = typeof delivery.address === 'string' ? delivery.address.trim() : '';
    if (!address) throw HttpError.badRequest('delivery.address is required');
    if (address.length > 300) throw HttpError.badRequest('delivery.address is too long');
    const location = delivery.location ?? {};
    const coord = (value, field, bound) => {
      if (value === undefined || value === null || value === '') return null;
      const number = Number(value);
      if (!Number.isFinite(number) || number < -bound || number > bound) {
        throw HttpError.badRequest(`delivery.location.${field} is invalid`);
      }
      return number;
    };
    return {
      address,
      location: {
        lat: coord(location.lat, 'lat', 90),
        lng: coord(location.lng, 'lng', 180),
      },
      courierId: delivery.courierId != null && delivery.courierId !== ''
        ? positiveInteger(delivery.courierId, 'delivery.courierId')
        : null,
      courierSnapshot: { name: '' },
    };
  }
}

module.exports = { LayawaysService, layawaysService: new LayawaysService() };
