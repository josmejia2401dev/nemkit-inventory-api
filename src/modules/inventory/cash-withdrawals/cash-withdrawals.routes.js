'use strict';

const { express } = require('nemkit');
const { foundation } = require('../../../config/foundation.js');
const { requireRole } = foundation.middlewares;
const { cashWithdrawalsController: c } = require('./cash-withdrawals.controller');
const router = express.Router();

// Solo el dueño/jefe de la empresa registra o anula retiros de caja.
router.use(requireRole('ADMIN'));
router.get('/summary', c.summary.bind(c));
router.get('/', c.list.bind(c));
router.post('/', c.create.bind(c));
router.delete('/:id', c.remove.bind(c));

module.exports = router;
