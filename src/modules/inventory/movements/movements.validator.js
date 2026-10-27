'use strict';

const { createValidator } = require('nemkit');
const { MOVEMENT_TYPE, MOVEMENT_TYPES } = require('../inventory.constants');

// Compra y venta tienen sus propios flujos; aquí solo se crean ajustes manuales,
// mermas, pérdidas y consumos internos.
const CREATABLE_MOVEMENT_TYPES = MOVEMENT_TYPES.filter((type) => ![
  MOVEMENT_TYPE.PURCHASE,
  MOVEMENT_TYPE.SALE,
].includes(type));

const createMovementSchema = createValidator({
  type: { type: 'string', required: true, enum: CREATABLE_MOVEMENT_TYPES },
  employeeId: { type: 'number', min: 1 },
  date: { type: 'date' },
  notes: { type: 'string', trim: true, maxLength: 1000 },
  items: { type: 'array', required: true, minLength: 1 },
});

module.exports = { createMovementSchema, CREATABLE_MOVEMENT_TYPES };
