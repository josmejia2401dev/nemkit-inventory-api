'use strict';

const { express } = require('nemkit');
const { foundation } = require('../../../../config/foundation.js');
const { requireRole } = foundation.middlewares;
const { reportsController: c } = require('./reports.controller');
const router = express.Router();

router.use(requireRole('ADMIN'));
router.get('/inventory', c.inventoryReport.bind(c));
router.get('/movements', c.movementsReport.bind(c));
router.get('/sales', c.salesReport.bind(c));
router.get('/sales-by-employee', c.salesByEmployee.bind(c));
router.get('/cancelled-sales', c.cancelledSales.bind(c));
router.get('/cash-flow', c.cashFlowReport.bind(c));

module.exports = router;
