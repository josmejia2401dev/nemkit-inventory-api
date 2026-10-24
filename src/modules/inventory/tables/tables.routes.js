'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { tablesController: c } = require('./tables.controller');

const router = express.Router();

// Consultar mesas/ocupación: meseros y caja. Gestionar mesas: solo administración.
router.get('/', c.list.bind(c));
router.get('/occupancy', c.occupancy.bind(c));
router.post('/', requireRole('ADMIN'), c.create.bind(c));
router.put('/:id', requireRole('ADMIN'), c.update.bind(c));
router.delete('/:id', requireRole('ADMIN'), c.remove.bind(c));

module.exports = router;
