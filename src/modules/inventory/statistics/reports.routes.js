'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { statisticsController: c } = require('./statistics.controller');
const router = express.Router();

router.use(requireRole('ADMIN'));
router.get('/inventory', c.inventoryReport.bind(c));
router.get('/movements', c.movementsReport.bind(c));
router.get('/sales', c.salesReport.bind(c));
router.get('/sales-by-employee', c.salesByEmployee.bind(c));
router.get('/cancelled-sales', c.cancelledSales.bind(c));

module.exports = router;
