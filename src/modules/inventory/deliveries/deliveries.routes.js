'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { deliveriesController: c } = require('./deliveries.controller');

const router = express.Router();

// Asignar domiciliario es de gestión (no lo hace el propio domiciliario).
const CAN_ASSIGN = ['ADMIN', 'SUPERADMIN', 'CASHIER', 'SELLER', 'WAITER'];

router.get('/', c.list.bind(c));
router.get('/:id', c.get.bind(c));
router.put('/:id/courier', requireRole(...CAN_ASSIGN), c.assignCourier.bind(c));
router.put('/:id/status', c.changeStatus.bind(c));
router.put('/:id/proof', c.setProof.bind(c));
router.put('/:id/void', c.voidDelivery.bind(c));

module.exports = router;
