'use strict';

const { BaseService, HttpError, RECORD_STATUS, UniqueNumberUtil } = require('nemkit');
const { employeesService } = require('../../../config/foundation-services.js');
const { productsService } = require('../products/products.service');
const { movementsService } = require('../movements/movements.service');
const { pagination, positiveInteger, parseDate } = require('../validation');
const {
  PRODUCT_TYPE,
  PURCHASABLE_TYPES,
  SELLABLE_TYPES,
  MOVEMENT_TYPE,
  MOVEMENT_DIRECTION,
  MOVEMENT_SOURCE_TYPE,
  ORDER_STATUS,
} = require('../inventory.constants');
const { buildDocumentItems } = require('./pricing');
const {
  buildStockConsumption,
  findInsufficientStock,
  buildMovementItems,
} = require('./stock-plan');

class InventoryDocumentService extends BaseService {
  constructor({ repository, contactService, contactField, movementType, direction, amountField, label, requiredContact = false }) {
    super(repository);
    this.contactService = contactService;
    this.contactField = contactField;
    this.movementType = movementType;
    this.direction = direction;
    this.amountField = amountField;
    this.label = label;
    this.requiredContact = requiredContact;
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
    const { items, date, contactId, notes } = this.#parseHeader(data);
    const isOut = this.direction === MOVEMENT_DIRECTION.OUT;

    return this.repository.withTransaction(async (session) => {
      const contact = await this.#resolveContact(contactId, userId, session);
      const { employeeId, employeeSnapshot } = await employeesService.resolveResponsible(
        userId,
        data.employeeId,
        session,
      );
      const productById = await this.#loadProducts(userId, items, isOut, session);
      const ingredientById = await this.#loadIngredients(userId, productById, isOut, session);

      const { documentItems, quantities, total } = buildDocumentItems({
        items,
        productById,
        ingredientById,
        amountField: this.amountField,
        isOut,
      });
      const stockPlan = buildStockConsumption({ quantities, productById, isOut });
      await this.#applyStockConsumption({
        plan: stockPlan,
        productById,
        ingredientById,
        userId,
        session,
        isOut,
      });

      const documentId = UniqueNumberUtil.generateRaw();
      const movementId = UniqueNumberUtil.generateRaw();
      const documentData = this.#buildDocument({
        documentId,
        movementId,
        userId,
        data,
        isOut,
        date,
        notes,
        contactId,
        contact,
        employeeId,
        employeeSnapshot,
        documentItems,
        total,
      });

      const document = await this.repository.createInSession(documentData, session);
      const movementItems = buildMovementItems({
        plan: stockPlan,
        productById,
        ingredientById,
        items: documentItems,
        direction: this.direction,
        isOut,
      });
      // Solo se registra un movimiento de inventario si hubo consumo real de
      // stock. Una venta compuesta únicamente por platos sin receta no mueve
      // existencias, así que no genera movimiento (el documento sí se guarda).
      if (movementItems.length > 0) {
        await movementsService.recordDocumentMovement({
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
        }, session);
      }

      // Hook dentro de la transacción (Ventas crea el domicilio asociado).
      await this.afterCreate({
        document,
        data,
        contact,
        items: documentItems,
        userId,
        session,
      });

      return this.repository.normalizeOutput(document);
    });
  }

  /** Fecha, contacto y notas del documento, ya validados. */
  #parseHeader(data) {
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
    return { items, date, contactId, notes };
  }

  async #resolveContact(contactId, userId, session) {
    if (contactId === null) return null;
    const contact = await this.contactService.getActiveForDocument(contactId, userId, session);
    if (!contact) throw HttpError.badRequest(`Invalid or inactive ${this.contactField}`);
    return contact;
  }

  /** Productos del documento, validando que existan y sean aptos para la operación. */
  async #loadProducts(userId, items, isOut, session) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await productsService.findActiveForStockChange(userId, productIds, session);
    if (products.length !== productIds.length) {
      throw HttpError.badRequest('One or more products are invalid or inactive');
    }

    const allowedTypes = isOut ? SELLABLE_TYPES : PURCHASABLE_TYPES;
    for (const product of products) {
      if (!allowedTypes.includes(product.type ?? PRODUCT_TYPE.SIMPLE)) {
        throw HttpError.badRequest(
          isOut
            ? `"${product.name}" is not sellable`
            : `"${product.name}" is not purchasable`,
        );
      }
    }

    return new Map(products.map((product) => [product._id, product]));
  }

  /** Insumos de las recetas de los platos; solo aplica a salidas. */
  async #loadIngredients(userId, productById, isOut, session) {
    const ingredientById = new Map();
    if (!isOut) return ingredientById;

    const ingredientIds = new Set();
    for (const product of productById.values()) {
      if (product.type !== PRODUCT_TYPE.PREPARED) continue;
      for (const ri of product.recipe ?? []) ingredientIds.add(ri.ingredientId);
    }
    if (!ingredientIds.size) return ingredientById;

    const ingredients = await productsService.findActiveForStockChange(
      userId,
      [...ingredientIds],
      session,
    );
    if (ingredients.length !== ingredientIds.size) {
      throw HttpError.badRequest('A recipe ingredient is invalid or inactive');
    }
    for (const ingredient of ingredients) ingredientById.set(ingredient._id, ingredient);

    return ingredientById;
  }

  /** Aplica el plan de stock; en salida exige existencias suficientes. */
  async #applyStockConsumption({ plan, productById, ingredientById, userId, session, isOut }) {
    const shortage = findInsufficientStock({ plan, productById, ingredientById, isOut });
    if (shortage) {
      throw HttpError.conflict(
        `Insufficient stock for ${shortage.product?.name ?? `product ${shortage.productId}`}`,
      );
    }

    for (const [productId, quantity] of plan) {
      const result = await productsService.changeStock(
        userId,
        productId,
        quantity,
        this.direction,
        session,
      );
      if (result.modifiedCount !== 1) throw HttpError.conflict('Stock changed; retry the document');
    }
  }

  /** Documento listo para persistir, con estado de pedido/pago ya resuelto. */
  #buildDocument({
    documentId,
    movementId,
    userId,
    data,
    isOut,
    date,
    notes,
    contactId,
    contact,
    employeeId,
    employeeSnapshot,
    documentItems,
    total,
  }) {
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
    if (isOut) {
      documentData.orderStatus = ORDER_STATUS.PENDING;
      documentData.orderChannel = data.delivery ? 'delivery' : 'on_site';
    }
    // Toda venta requiere confirmación explícita del cobro; las compras no
    // representan dinero recibido por caja.
    if (isOut || data.paymentStatus === 'pending') {
      documentData.paymentStatus = 'pending';
      documentData.paidAt = null;
    } else {
      documentData.paymentStatus = 'paid';
      documentData.paidAt = date;
    }
    return documentData;
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

  #contactSnapshot(contact) {
    return {
      name: contact.name,
      document: contact.document || '',
      phone: contact.phone || '',
      email: contact.email || '',
      ...(contact.address !== undefined ? { address: contact.address || '' } : {}),
    };
  }
}

module.exports = { InventoryDocumentService };
