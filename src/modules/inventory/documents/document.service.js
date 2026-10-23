'use strict';

const { BaseService, MongoRepository, HttpError, RECORD_STATUS, UniqueNumberUtil } = require('nemkit');
const Product = require('../products/products.model');
const Movement = require('../movements/movements.model');
const Employee = require('../employees/employees.model');
const { resolveEmployee } = require('../employees/employee-responsible');
const { pagination, positiveInteger, parseDate } = require('../validation');
const {
  PRODUCT_STATUS,
  MOVEMENT_TYPE,
  MOVEMENT_DIRECTION,
  MOVEMENT_SOURCE_TYPE,
  resolveLoyaltyTier,
} = require('../inventory.constants');

class InventoryDocumentService extends BaseService {
  constructor({ model, contactModel, contactField, movementType, direction, amountField, label, requiredContact = false }) {
    const repository = new MongoRepository(model);
    super(repository);
    this.documentModel = model;
    this.contactModel = contactModel;
    this.contactField = contactField;
    this.movementType = movementType;
    this.direction = direction;
    this.amountField = amountField;
    this.label = label;
    this.requiredContact = requiredContact;
    // Solo las ventas (contacto = cliente) actualizan métricas de fidelización.
    this.updatesCustomerStats = contactField === 'customerId';
  }

  async list(userId, query = {}) {
    const { page, limit } = pagination(query);
    const filter = { userId, recordStatus: RECORD_STATUS.ACTIVE };
    if (query.contactId !== undefined) {
      filter[this.contactField] = positiveInteger(query.contactId, 'contactId');
    }
    if (query.search !== undefined) {
      if (typeof query.search !== 'string' || query.search.length > 100) {
        throw HttpError.badRequest('search must be a string of at most 100 characters');
      }
      if (query.search.trim()) filter._id = positiveInteger(query.search, 'documentId');
    }
    const from = parseDate(query.from, 'from');
    const to = parseDate(query.to, 'to');
    if (from && to && from > to) throw HttpError.badRequest('from must be before to');
    return this.filterAndPaginate(filter, {
      page,
      limit,
      between: { field: 'date', from, to },
      sort: { date: -1, _id: -1 },
    });
  }

  async getOwned(id, userId) {
    const documentId = positiveInteger(id, `${this.label}Id`);
    const document = await this.findOne({
      _id: documentId,
      userId,
      recordStatus: RECORD_STATUS.ACTIVE,
    });
    if (!document) throw HttpError.notFound(`${this.label} not found`);
    return document;
  }

  async create(data, userId) {
    const items = this.#validateItems(data.items);
    const date = data.date ? parseDate(data.date, 'date') : new Date();
    const contactId = data[this.contactField] == null
      ? null
      : positiveInteger(data[this.contactField], this.contactField);
    if (this.requiredContact && contactId === null) {
      throw HttpError.badRequest(`${this.contactField} is required`);
    }
    const notes = data.notes ?? '';
    if (typeof notes !== 'string' || notes.length > 1000) {
      throw HttpError.badRequest('notes must be a string of at most 1000 characters');
    }

    return this.repository.withTransaction(async (session) => {
      let contact = null;
      if (contactId !== null) {
        contact = await this.contactModel.findOne({
          _id: contactId,
          userId,
          recordStatus: RECORD_STATUS.ACTIVE,
        }).session(session).lean();
        if (!contact) throw HttpError.badRequest(`Invalid or inactive ${this.contactField}`);
      }

      const { employeeId, employeeSnapshot } = await resolveEmployee({
        Employee,
        userId,
        employeeId: data.employeeId,
        session,
      });

      const productIds = [...new Set(items.map((item) => item.productId))];
      const products = await Product.find({
        userId,
        _id: { $in: productIds },
        status: PRODUCT_STATUS.ACTIVE,
        recordStatus: RECORD_STATUS.ACTIVE,
      }).session(session).lean();
      if (products.length !== productIds.length) {
        throw HttpError.badRequest('One or more products are invalid or inactive');
      }

      const productById = new Map(products.map((product) => [product._id, product]));
      const quantities = new Map();
      const documentItems = items.map((item) => {
        const product = productById.get(item.productId);
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
        const unitAmount = item[this.amountField];
        const lineTotal = this.#roundMoney(unitAmount * item.quantity);
        return {
          productId: item.productId,
          sku: product.sku,
          name: product.name,
          quantity: item.quantity,
          unitCost: this.direction === MOVEMENT_DIRECTION.IN ? unitAmount : product.purchasePrice,
          ...(this.direction === MOVEMENT_DIRECTION.OUT ? { unitPrice: unitAmount } : {}),
          lineTotal,
        };
      });

      for (const product of products) {
        const quantity = quantities.get(product._id);
        if (this.direction === MOVEMENT_DIRECTION.OUT && product.stock < quantity) {
          throw HttpError.conflict(`Insufficient stock for ${product.name}`);
        }
        const stockFilter = {
          _id: product._id,
          userId,
          status: PRODUCT_STATUS.ACTIVE,
          recordStatus: RECORD_STATUS.ACTIVE,
        };
        if (this.direction === MOVEMENT_DIRECTION.OUT) stockFilter.stock = { $gte: quantity };
        const result = await Product.updateOne(
          stockFilter,
          { $inc: { stock: this.direction === MOVEMENT_DIRECTION.IN ? quantity : -quantity } },
          { session },
        );
        if (result.modifiedCount !== 1) throw HttpError.conflict('Stock changed; retry the document');
      }

      const documentId = UniqueNumberUtil.generateRaw();
      const movementId = UniqueNumberUtil.generateRaw();
      const total = this.#roundMoney(documentItems.reduce((sum, item) => sum + item.lineTotal, 0));
      const documentData = {
        _id: documentId,
        userId,
        date,
        notes,
        employeeId,
        employeeSnapshot,
        items: documentItems,
        total,
        movementId,
        createdBy: userId,
        updatedBy: userId,
      };
      if (contactId !== null) {
        documentData[this.contactField] = contactId;
        documentData[this.contactField === 'supplierId' ? 'supplierSnapshot' : 'customerSnapshot'] = this.#contactSnapshot(contact);
      }

      const [document] = await this.documentModel.create([documentData], { session });
      const movementItems = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        direction: this.direction,
        ...(this.direction === MOVEMENT_DIRECTION.IN
          ? { unitCost: item.unitCost }
          : {
            unitCost: productById.get(item.productId).purchasePrice,
            unitPrice: item.unitPrice,
          }),
      }));
      await Movement.create([{
        _id: movementId,
        userId,
        date,
        type: this.movementType,
        notes,
        employeeId,
        employeeSnapshot,
        sourceType: this.movementType === MOVEMENT_TYPE.PURCHASE
          ? MOVEMENT_SOURCE_TYPE.PURCHASE
          : MOVEMENT_SOURCE_TYPE.SALE,
        sourceId: documentId,
        items: movementItems,
        createdBy: userId,
        updatedBy: userId,
      }], { session });

      if (this.updatesCustomerStats && contactId !== null && contact) {
        await this.#updateCustomerStats(contact, total, date, userId, session);
      }

      // Hook de extensión dentro de la misma transacción (lo usa Ventas para
      // crear el domicilio asociado cuando la venta es a domicilio).
      await this.afterCreate({ document, data, contact, items: documentItems, userId, session });

      return this.repository.normalizeOutput(document);
    });
  }

  /**
   * Gancho de extensión ejecutado dentro de la transacción de creación del
   * documento. Por defecto no hace nada; las subclases lo sobrescriben.
   */
  async afterCreate() {}

  #validateItems(items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 500) {
      throw HttpError.badRequest('items must contain between 1 and 500 entries');
    }
    return items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw HttpError.badRequest('Each item must be an object');
      }
      const allowed = new Set(['productId', 'quantity', this.amountField]);
      if (Object.keys(item).some((key) => !allowed.has(key))) {
        throw HttpError.badRequest('Document item contains unsupported fields');
      }
      const amount = item[this.amountField];
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
        throw HttpError.badRequest(`${this.amountField} must be a non-negative number`);
      }
      return {
        productId: positiveInteger(item.productId, 'productId'),
        quantity: positiveInteger(item.quantity, 'quantity'),
        [this.amountField]: amount,
      };
    });
  }

  /**
   * Actualiza, dentro de la misma transacción de la venta, las métricas de
   * fidelización del cliente: total gastado, nº de compras, primera/última
   * compra y nivel. Desnormalizado para que la búsqueda por celular sea inmediata.
   */
  async #updateCustomerStats(contact, total, date, userId, session) {
    const previousSpent = contact.stats?.totalSpent ?? 0;
    const previousCount = contact.stats?.purchaseCount ?? 0;
    const newSpent = this.#roundMoney(previousSpent + total);
    const newCount = previousCount + 1;
    const firstPurchaseAt = contact.stats?.firstPurchaseAt ?? date;
    const loyaltyTier = resolveLoyaltyTier(newSpent, newCount);

    await this.contactModel.updateOne(
      { _id: contact._id, userId },
      {
        $set: {
          'stats.totalSpent': newSpent,
          'stats.purchaseCount': newCount,
          'stats.firstPurchaseAt': firstPurchaseAt,
          'stats.lastPurchaseAt': date,
          loyaltyTier,
          updatedBy: userId,
        },
      },
      { session },
    );
  }

  #contactSnapshot(contact) {
    return {
      name: contact.name,
      document: contact.document || '',
      phone: contact.phone || '',
      email: contact.email || '',
      ...(contact.address !== undefined ? { address: contact.address || '' } : {}),
    };
  }

  #roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}

module.exports = { InventoryDocumentService };
