'use strict';

const { express } = require('nemkit');
const { foundation } = require('../../../../config/foundation.js');
const { requireRole } = foundation.middlewares;
const { dashboardController: c } = require('./dashboard.controller');
const router = express.Router();

router.get('/summary', requireRole('ADMIN'), c.dashboardSummary.bind(c));
router.get('/alerts', requireRole('ADMIN'), c.stockAlerts.bind(c));

module.exports = router;
