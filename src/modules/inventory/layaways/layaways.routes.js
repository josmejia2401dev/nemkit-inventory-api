'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { layawaysController: c } = require('./layaways.controller');

const router = express.Router();

// Rutas fijas antes de /:id para evitar colisiones.
router.get('/settings', c.getSettings.bind(c));
router.put('/settings', requireRole('ADMIN'), c.updateSettings.bind(c));
router.post('/authorizations', c.authorize.bind(c));

router.get('/', c.list.bind(c));
router.post('/', c.create.bind(c));
router.get('/:id', c.get.bind(c));
router.put('/:id', c.update.bind(c));
router.post('/:id/payments', c.addPayment.bind(c));
router.post('/:id/deliver', c.deliver.bind(c));
router.post('/:id/cancel', c.cancel.bind(c));

module.exports = router;
