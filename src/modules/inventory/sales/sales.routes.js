'use strict';
const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { salesController: c } = require('./sales.controller');
const router = express.Router();
router.get('/', c.list.bind(c));
router.post('/', c.create.bind(c));
router.get('/:id', c.get.bind(c));
router.put('/:id/status', c.changeStatus.bind(c));
// Administración o ventas registra el cobro cuando recibe el dinero.
router.put('/:id/pay', requireRole('ADMIN', 'SELLER'), c.pay.bind(c));
// Cancelar un pedido/venta con motivo (repone stock).
router.put('/:id/cancel', c.cancel.bind(c));
module.exports = router;
