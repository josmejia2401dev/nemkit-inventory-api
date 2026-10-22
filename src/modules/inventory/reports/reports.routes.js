'use strict';

const { express } = require('nemkit');
const { reportsController: c } = require('./reports.controller');
const router = express.Router();

router.get('/inventory', c.inventory.bind(c));
router.get('/movements', c.movements.bind(c));
router.get('/sales', c.sales.bind(c));

module.exports = router;
