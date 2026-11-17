'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../../middlewares/authorize.middleware');
const { reportsController: c } = require('./reports.controller');
const router = express.Router();

router.get('/sales', requireRole('ADMIN'), c.salesByEmployee.bind(c));
router.get('/payments', requireRole('ADMIN'), c.employeePaymentSummary.bind(c));

module.exports = router;
