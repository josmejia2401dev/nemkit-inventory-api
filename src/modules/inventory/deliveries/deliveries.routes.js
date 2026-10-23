'use strict';

const { express } = require('nemkit');
const { deliveriesController: c } = require('./deliveries.controller');

const router = express.Router();

router.get('/', c.list.bind(c));
router.get('/:id', c.get.bind(c));
router.put('/:id/courier', c.assignCourier.bind(c));
router.put('/:id/status', c.changeStatus.bind(c));
router.put('/:id/proof', c.setProof.bind(c));
router.put('/:id/void', c.voidDelivery.bind(c));

module.exports = router;
