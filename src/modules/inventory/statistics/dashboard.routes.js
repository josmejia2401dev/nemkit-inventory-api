'use strict';

const { express } = require('nemkit');
const { requireRole } = require('../../../middlewares/authorize.middleware');
const { statisticsController: c } = require('./statistics.controller');
const router = express.Router();

router.get('/summary', requireRole('ADMIN'), c.dashboardSummary.bind(c));
router.get('/alerts', requireRole('ADMIN', 'WAREHOUSE'), c.stockAlerts.bind(c));

module.exports = router;
