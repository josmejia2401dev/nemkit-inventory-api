'use strict';

const { express } = require('nemkit');
const { salesController: c } = require('./sales.controller');

const router = express.Router();

// Cola de cocina (comandas) y cambio de estado. Reutiliza el controller de ventas,
// ya que la comanda ES la venta (modo restaurante).
router.get('/', c.kitchenQueue.bind(c));
router.put('/:id', c.changeKitchen.bind(c));

module.exports = router;
