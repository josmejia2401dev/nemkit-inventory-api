'use strict';

const { express } = require('nemkit');
const { kitchenController: c } = require('./kitchen.controller');

const router = express.Router();

router.get('/', c.queue.bind(c));
router.put('/:id', c.changeStatus.bind(c));
router.put('/:id/cancel', c.cancel.bind(c));

module.exports = router;
