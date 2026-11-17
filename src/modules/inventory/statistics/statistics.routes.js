'use strict';

const { express } = require('nemkit');
const dashboardRoutes = require('./dashboard/dashboard.routes');
const loyaltyRoutes = require('./loyalty/loyalty.routes');
const employeeRoutes = require('./reports/employee-reports.routes');
const reportsRoutes = require('./reports/reports.routes');
const router = express.Router();

router.use('/dashboard', dashboardRoutes);
router.use('/customers', loyaltyRoutes);
router.use('/employees', employeeRoutes);
router.use('/reports', reportsRoutes);

module.exports = router;
