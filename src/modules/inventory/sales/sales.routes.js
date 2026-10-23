'use strict';
const { express } = require('nemkit');
const { salesController: c } = require('./sales.controller');
const router = express.Router();
router.get('/', c.list.bind(c));
router.post('/', c.create.bind(c));
router.get('/:id', c.get.bind(c));
// Cobrar una venta "por cobrar" (restaurante). CASHIER/SELLER/WAITER/ADMIN vía permisos de 'sales'.
router.put('/:id/pay', c.pay.bind(c));
// Cancelar un pedido/venta con motivo (repone stock).
router.put('/:id/cancel', c.cancel.bind(c));
module.exports = router;
