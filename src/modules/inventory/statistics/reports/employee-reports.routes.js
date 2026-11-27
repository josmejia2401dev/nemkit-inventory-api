'use strict';

const { express } = require('nemkit');
const { foundation } = require('../../../../config/foundation.js');
const { requireRole } = foundation.middlewares;
const { reportsController: c } = require('./reports.controller');
const router = express.Router();

router.get('/sales', requireRole('ADMIN'), c.salesByEmployee.bind(c));

module.exports = router;
