'use strict';
const { express } = require('nemkit');
const { dashboardController } = require('./dashboard.controller');
const router = express.Router();

router.get('/alerts', dashboardController.alerts.bind(dashboardController));
router.get('/summary', dashboardController.summary.bind(dashboardController));

module.exports = router;
