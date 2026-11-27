'use strict';

const { express } = require('nemkit');
const { foundation } = require('../../../config/foundation');
const { requireRole } = foundation.middlewares;
const { salesController: c } = require('./sales.controller');
const router = express.Router();

router.get('/', c.list.bind(c));
router.post('/', c.create.bind(c));
router.get('/:id', c.get.bind(c));
// Caja, ventas o administración registran el cobro cuando reciben el dinero.
router.put('/:id/pay', requireRole('ADMIN', 'CASHIER', 'SELLER'), c.pay.bind(c));
// Cancelar un pedido/venta con motivo (repone stock).
router.put('/:id/cancel', c.cancel.bind(c));

module.exports = router;
