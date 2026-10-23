'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { employeesController: c } = require('./employees.controller');

const router = express.Router();

// La gestión de empleados es exclusiva del administrador de la cuenta.
router.get('/', c.list.bind(c));
router.post('/', requireRole('ADMIN'), c.create.bind(c));
router.get('/:id', c.get.bind(c));
router.put('/:id', requireRole('ADMIN'), c.update.bind(c));
router.delete('/:id', requireRole('ADMIN'), c.remove.bind(c));

module.exports = router;
