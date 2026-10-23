'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { deliveriesController: c } = require('./deliveries.controller');

const router = express.Router();

// Gestión (no la hace el propio domiciliario): asignar y anular.
const MANAGEMENT = ['ADMIN', 'SUPERADMIN', 'CASHIER', 'SELLER', 'WAITER'];

router.get('/', c.list.bind(c));
router.get('/:id', c.get.bind(c));
router.put('/:id/courier', requireRole(...MANAGEMENT), c.assignCourier.bind(c));
router.put('/:id/status', c.changeStatus.bind(c));
router.put('/:id/proof', c.setProof.bind(c));
// Anular revierte la venta (stock, ingreso, fidelidad): solo gestión, no el courier.
router.put('/:id/void', requireRole(...MANAGEMENT), c.voidDelivery.bind(c));

module.exports = router;
