'use strict';

const { express } = require('nemkit');
const dashboardRoutes = require('./dashboard.routes');
const customerRoutes = require('./customer-statistics.routes');
const employeeRoutes = require('./employee-statistics.routes');
const reportsRoutes = require('./reports.routes');
const router = express.Router();

router.use('/dashboard', dashboardRoutes);
router.use('/customers', customerRoutes);
router.use('/employees', employeeRoutes);
router.use('/reports', reportsRoutes);

module.exports = router;
