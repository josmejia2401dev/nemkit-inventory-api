'use strict';

const { HttpError, UniqueNumberUtil } = require('nemkit');
const { employeesService } = require('../../../config/foundation-services');
const { deliveriesService } = require('../deliveries/deliveries.service');
const { positiveInteger } = require('../validation');
const { DELIVERY_STATUS } = require('../inventory.constants');

/**
 * Pedido de entrega asociado a una venta. Si la venta trae el bloque
 * `delivery`, se crea dentro de la misma transacción; la venta ya descontó el
 * stock y el domicilio es solo logística de entrega.
 */
async function createDeliveryForSale({ document, delivery, contact, items, userId, session }) {
  if (!delivery) return null;

  const address = typeof delivery.address === 'string' ? delivery.address.trim() : '';
  if (!address || address.length > 300) {
    throw HttpError.badRequest('delivery.address is required and must be at most 300 characters');
  }

  const location = validateDeliveryLocation(delivery.location);
  const courier = await resolveCourier(userId, delivery.courierId, session);
  const snapshot = document.customerSnapshot ?? {};

  return deliveriesService.createFromSale({
    _id: UniqueNumberUtil.generateRaw(),
    userId,
    saleId: document._id,
    customerId: document.customerId ?? null,
    customerSnapshot: {
      name: contact?.name || snapshot.name || 'Cliente',
      phone: contact?.phone || snapshot.phone || '',
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

function validateDeliveryLocation(location) {
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

async function resolveCourier(userId, courierId, session) {
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

module.exports = { createDeliveryForSale };
